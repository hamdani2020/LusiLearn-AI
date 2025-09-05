/**
 * API validation middleware for integrating runtime validation with the API client
 * Provides automatic request/response validation with type safety
 */

import { z } from 'zod';
import { RequestInterceptor, RequestContext, ApiError } from '../api-client/types';
import { EnhancedApiError } from '../api-client/errors';
import { RuntimeValidator, RuntimeValidationError } from './runtime-validator';
import {
  RequestOptionsSchema,
  EnhancedApiResponseSchema,
  validateRequestPayload,
  validateApiResponse
} from './index';

/**
 * Configuration for API validation middleware
 */
export interface ApiValidationConfig {
  validateRequests: boolean;
  validateResponses: boolean;
  validateOptions: boolean;
  strictMode: boolean;
  logValidationErrors: boolean;
  throwOnValidationError: boolean;
  skipValidationForEndpoints?: string[];
  customSchemas?: Map<string, { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }>;
}

/**
 * Default validation configuration
 */
const DEFAULT_VALIDATION_CONFIG: ApiValidationConfig = {
  validateRequests: true,
  validateResponses: true,
  validateOptions: true,
  strictMode: process.env.NODE_ENV === 'development',
  logValidationErrors: process.env.NODE_ENV === 'development',
  throwOnValidationError: false,
  skipValidationForEndpoints: ['/api/health', '/api/ping']
};

/**
 * API validation middleware class
 */
export class ApiValidationMiddleware implements RequestInterceptor {
  private validator: RuntimeValidator;
  private config: ApiValidationConfig;
  private endpointSchemas = new Map<string, { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }>();

  constructor(config: Partial<ApiValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
    this.validator = new RuntimeValidator({
      enableValidation: true,
      strictMode: this.config.strictMode,
      logValidationErrors: this.config.logValidationErrors,
      throwOnValidationError: this.config.throwOnValidationError
    });

    // Initialize custom schemas if provided
    if (this.config.customSchemas) {
      this.endpointSchemas = new Map(this.config.customSchemas);
    }
  }

  /**
   * Request interceptor - validates request options and payload
   */
  async onRequest(config: RequestInit, context: RequestContext): Promise<RequestInit> {
    // Skip validation for excluded endpoints
    if (this.shouldSkipValidation(context.endpoint)) {
      return config;
    }

    try {
      // Validate request options
      if (this.config.validateOptions && context.options) {
        const optionsResult = this.validator.validateRequestOptions(context.options);
        if (!optionsResult.success && this.config.throwOnValidationError) {
          throw new RuntimeValidationError(
            `Request options validation failed for ${context.endpoint}`,
            optionsResult.errors
          );
        }
      }

      // Validate request payload if present
      if (this.config.validateRequests && config.body && context.method !== 'GET') {
        const requestSchema = this.getRequestSchema(context.endpoint, context.method);
        if (requestSchema) {
          let payload: any;
          try {
            payload = JSON.parse(config.body as string);
          } catch {
            // If body is not JSON, skip validation
            return config;
          }

          const payloadResult = this.validator.validateRequestPayload(
            payload,
            requestSchema,
            context.endpoint
          );

          if (!payloadResult.success) {
            if (this.config.throwOnValidationError) {
              throw new RuntimeValidationError(
                `Request payload validation failed for ${context.endpoint}`,
                payloadResult.errors
              );
            } else if (this.config.logValidationErrors) {
              console.error('Request payload validation failed:', {
                endpoint: context.endpoint,
                method: context.method,
                errors: payloadResult.errors,
                payload
              });
            }
          } else if (payloadResult.data) {
            // Update the request body with validated data
            config.body = JSON.stringify(payloadResult.data);
          }
        }
      }

      return config;
    } catch (error) {
      if (error instanceof RuntimeValidationError) {
        throw EnhancedApiError.fromValidationError(error, context.requestId);
      }
      throw error;
    }
  }

  /**
   * Response interceptor - validates response data
   */
  async onResponse(response: Response, context: RequestContext): Promise<Response> {
    // Skip validation for excluded endpoints
    if (this.shouldSkipValidation(context.endpoint)) {
      return response;
    }

    // Only validate successful responses with JSON content
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return response;
    }

    if (this.config.validateResponses) {
      try {
        // Clone response to avoid consuming the stream
        const responseClone = response.clone();
        const responseData = await responseClone.json();

        const responseSchema = this.getResponseSchema(context.endpoint, context.method);
        if (responseSchema) {
          const responseResult = this.validator.validateApiResponse(
            responseData,
            responseSchema,
            context.endpoint
          );

          if (!responseResult.success) {
            if (this.config.throwOnValidationError) {
              throw new RuntimeValidationError(
                `Response validation failed for ${context.endpoint}`,
                responseResult.errors
              );
            } else if (this.config.logValidationErrors) {
              console.error('Response validation failed:', {
                endpoint: context.endpoint,
                method: context.method,
                errors: responseResult.errors,
                response: responseData
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof RuntimeValidationError) {
          throw EnhancedApiError.fromValidationError(error, context.requestId);
        }
        // If we can't parse the response, let it pass through
        if (this.config.logValidationErrors) {
          console.warn('Could not validate response - not valid JSON:', {
            endpoint: context.endpoint,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return response;
  }

  /**
   * Error interceptor - validates error format
   */
  async onError(error: ApiError, context: RequestContext): Promise<ApiError> {
    if (this.config.validateResponses && !this.shouldSkipValidation(context.endpoint)) {
      const errorResult = this.validator.validateError(error);
      if (!errorResult.success && this.config.logValidationErrors) {
        console.warn('Error object validation failed:', {
          endpoint: context.endpoint,
          errors: errorResult.errors,
          error
        });
      }
    }

    return error;
  }

  /**
   * Registers a schema for a specific endpoint and method
   */
  registerSchema(
    endpoint: string,
    method: string,
    schemas: { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }
  ): void {
    const key = this.getSchemaKey(endpoint, method);
    this.endpointSchemas.set(key, schemas);
  }

  /**
   * Registers multiple schemas at once
   */
  registerSchemas(
    schemas: Record<string, { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }>
  ): void {
    for (const [key, schema] of Object.entries(schemas)) {
      this.endpointSchemas.set(key, schema);
    }
  }

  /**
   * Removes schema for a specific endpoint and method
   */
  unregisterSchema(endpoint: string, method: string): void {
    const key = this.getSchemaKey(endpoint, method);
    this.endpointSchemas.delete(key);
  }

  /**
   * Gets all registered schemas
   */
  getRegisteredSchemas(): Map<string, { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }> {
    return new Map(this.endpointSchemas);
  }

  /**
   * Updates middleware configuration
   */
  updateConfig(newConfig: Partial<ApiValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validator.updateConfig({
      strictMode: this.config.strictMode,
      logValidationErrors: this.config.logValidationErrors,
      throwOnValidationError: this.config.throwOnValidationError
    });
  }

  /**
   * Gets current middleware configuration
   */
  getConfig(): ApiValidationConfig {
    return { ...this.config };
  }

  /**
   * Enables or disables validation
   */
  setValidationEnabled(enabled: boolean): void {
    this.config.validateRequests = enabled;
    this.config.validateResponses = enabled;
    this.validator.setValidationEnabled(enabled);
  }

  /**
   * Adds endpoint to skip list
   */
  addSkipEndpoint(endpoint: string): void {
    if (!this.config.skipValidationForEndpoints) {
      this.config.skipValidationForEndpoints = [];
    }
    if (!this.config.skipValidationForEndpoints.includes(endpoint)) {
      this.config.skipValidationForEndpoints.push(endpoint);
    }
  }

  /**
   * Removes endpoint from skip list
   */
  removeSkipEndpoint(endpoint: string): void {
    if (this.config.skipValidationForEndpoints) {
      const index = this.config.skipValidationForEndpoints.indexOf(endpoint);
      if (index > -1) {
        this.config.skipValidationForEndpoints.splice(index, 1);
      }
    }
  }

  /**
   * Private helper methods
   */
  private shouldSkipValidation(endpoint: string): boolean {
    return this.config.skipValidationForEndpoints?.some(skipEndpoint => 
      endpoint.startsWith(skipEndpoint)
    ) || false;
  }

  private getSchemaKey(endpoint: string, method: string): string {
    return `${method.toUpperCase()}:${endpoint}`;
  }

  private getRequestSchema(endpoint: string, method: string): z.ZodSchema<any> | undefined {
    const key = this.getSchemaKey(endpoint, method);
    return this.endpointSchemas.get(key)?.request;
  }

  private getResponseSchema(endpoint: string, method: string): z.ZodSchema<any> | undefined {
    const key = this.getSchemaKey(endpoint, method);
    return this.endpointSchemas.get(key)?.response;
  }
}

/**
 * Factory function for creating API validation middleware
 */
export function createApiValidationMiddleware(config: Partial<ApiValidationConfig> = {}): ApiValidationMiddleware {
  return new ApiValidationMiddleware(config);
}

/**
 * Default API validation middleware instance
 */
export const apiValidationMiddleware = createApiValidationMiddleware();

/**
 * Convenience function to create middleware with common schemas
 */
export function createValidationMiddlewareWithSchemas(
  schemas: Record<string, { request?: z.ZodSchema<any>; response?: z.ZodSchema<any> }>,
  config: Partial<ApiValidationConfig> = {}
): ApiValidationMiddleware {
  const middleware = new ApiValidationMiddleware(config);
  middleware.registerSchemas(schemas);
  return middleware;
}