/**
 * Runtime validation system for API interactions
 * Provides comprehensive validation with detailed error reporting and type safety
 */

import { z } from 'zod';
import { 
  validateApiResponse, 
  validateRequestPayload, 
  ValidationResult,
  createValidator,
  createTypeGuard,
  createAssertion
} from './utils';
import { ValidationError as ValidationErrorType } from './schemas';
import {
  EnhancedApiResponseSchema,
  RequestOptionsSchema,
  ApiErrorSchema,
  ErrorTypeSchema
} from './schemas';

/**
 * Configuration for the runtime validator
 */
export interface ValidatorConfig {
  enableValidation: boolean;
  strictMode: boolean;
  logValidationErrors: boolean;
  throwOnValidationError: boolean;
  customErrorHandler?: (errors: ValidationErrorType[]) => void;
}

/**
 * Default validator configuration
 */
const DEFAULT_CONFIG: ValidatorConfig = {
  enableValidation: true,
  strictMode: process.env.NODE_ENV === 'development',
  logValidationErrors: process.env.NODE_ENV === 'development',
  throwOnValidationError: false
};

/**
 * Runtime validator class for API interactions
 */
export class RuntimeValidator {
  private config: ValidatorConfig;
  private validationCache = new Map<string, z.ZodSchema<any>>();

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validates API response with comprehensive error handling
   */
  validateApiResponse<T>(
    response: unknown,
    dataSchema: z.ZodType<T, any, any>,
    endpoint?: string
  ): ValidationResult & { data?: T } {
    if (!this.config.enableValidation) {
      return { success: true, data: response as T };
    }

    const result = validateApiResponse(response, dataSchema, endpoint);

    if (!result.success && this.config.logValidationErrors) {
      console.error('API Response validation failed:', {
        endpoint,
        errors: result.errors,
        response
      });
    }

    if (!result.success && this.config.throwOnValidationError) {
      const errorMessage = result.errors?.map(err => `${err.field}: ${err.message}`).join(', ') || 'Validation failed';
      throw new RuntimeValidationError(`API response validation failed${endpoint ? ` for ${endpoint}` : ''}: ${errorMessage}`);
    }

    if (!result.success && this.config.customErrorHandler) {
      this.config.customErrorHandler(result.errors || []);
    }

    return result;
  }

  /**
   * Validates request payload before API call
   */
  validateRequestPayload<T>(
    payload: unknown,
    schema: z.ZodType<T, any, any>,
    endpoint?: string
  ): ValidationResult & { data?: T } {
    if (!this.config.enableValidation) {
      return { success: true, data: payload as T };
    }

    const result = validateRequestPayload(payload, schema, endpoint);

    if (!result.success && this.config.logValidationErrors) {
      console.error('Request payload validation failed:', {
        endpoint,
        errors: result.errors,
        payload
      });
    }

    if (!result.success && this.config.throwOnValidationError) {
      const errorMessage = result.errors?.map(err => `${err.field}: ${err.message}`).join(', ') || 'Validation failed';
      throw new RuntimeValidationError(`Request payload validation failed${endpoint ? ` for ${endpoint}` : ''}: ${errorMessage}`);
    }

    if (!result.success && this.config.customErrorHandler) {
      this.config.customErrorHandler(result.errors || []);
    }

    return result;
  }

  /**
   * Validates request options
   */
  validateRequestOptions(options: unknown): ValidationResult & { data?: any } {
    if (!this.config.enableValidation) {
      return { success: true, data: options };
    }

    const validator = createValidator(RequestOptionsSchema, 'request options');
    const result = validator(options);

    if (!result.success && this.config.logValidationErrors) {
      console.error('Request options validation failed:', {
        errors: result.errors,
        options
      });
    }

    return result;
  }

  /**
   * Validates error objects
   */
  validateError(error: unknown): ValidationResult & { data?: any } {
    if (!this.config.enableValidation) {
      return { success: true, data: error };
    }

    const validator = createValidator(ApiErrorSchema, 'API error');
    return validator(error);
  }

  /**
   * Creates a cached validator for a specific schema
   */
  createCachedValidator<T>(
    schema: z.ZodType<T, any, any>,
    cacheKey: string,
    context?: string
  ): (data: unknown) => ValidationResult & { data?: T } {
    // Cache the schema for reuse
    this.validationCache.set(cacheKey, schema);

    return (data: unknown) => {
      if (!this.config.enableValidation) {
        return { success: true, data: data as T };
      }

      const cachedSchema = this.validationCache.get(cacheKey) as z.ZodType<T, any, any>;
      const validator = createValidator(cachedSchema, context);
      const result = validator(data);

      if (!result.success && this.config.logValidationErrors) {
        console.error(`Cached validation failed for ${cacheKey}:`, {
          context,
          errors: result.errors,
          data
        });
      }

      return result;
    };
  }

  /**
   * Creates a type guard with validation
   */
  createValidatedTypeGuard<T>(schema: z.ZodType<T, any, any>): (data: unknown) => data is T {
    if (!this.config.enableValidation) {
      return (data: unknown): data is T => true;
    }

    return createTypeGuard(schema);
  }

  /**
   * Creates an assertion function with validation
   */
  createValidatedAssertion<T>(
    schema: z.ZodType<T, any, any>,
    context?: string
  ): (data: unknown) => asserts data is T {
    if (!this.config.enableValidation) {
      return (data: unknown): asserts data is T => {};
    }

    return createAssertion(schema, context);
  }

  /**
   * Validates and transforms data with error recovery
   */
  validateWithRecovery<T>(
    data: unknown,
    schema: z.ZodType<T, any, any>,
    fallback: T,
    context?: string
  ): T {
    if (!this.config.enableValidation) {
      return data as T;
    }

    try {
      return schema.parse(data);
    } catch (error) {
      if (this.config.logValidationErrors) {
        console.warn(`Validation failed${context ? ` for ${context}` : ''}, using fallback:`, {
          error: error instanceof z.ZodError ? error.issues : error,
          data,
          fallback
        });
      }

      return fallback;
    }
  }

  /**
   * Validates array data with partial success handling
   */
  validateArrayWithPartialSuccess<T>(
    items: unknown[],
    itemSchema: z.ZodType<T, any, any>,
    context?: string
  ): { validItems: T[]; invalidItems: Array<{ index: number; item: unknown; errors: ValidationErrorType[] }> } {
    const validItems: T[] = [];
    const invalidItems: Array<{ index: number; item: unknown; errors: ValidationErrorType[] }> = [];

    if (!this.config.enableValidation) {
      return { validItems: items as T[], invalidItems: [] };
    }

    items.forEach((item, index) => {
      const validator = createValidator(itemSchema, `${context || 'array item'} at index ${index}`);
      const result = validator(item);

      if (result.success && result.data !== undefined) {
        validItems.push(result.data);
      } else {
        invalidItems.push({
          index,
          item,
          errors: result.errors || []
        });
      }
    });

    if (invalidItems.length > 0 && this.config.logValidationErrors) {
      console.warn(`Array validation had ${invalidItems.length} invalid items:`, {
        context,
        invalidItems: invalidItems.map(({ index, errors }) => ({ index, errors }))
      });
    }

    return { validItems, invalidItems };
  }

  /**
   * Validates nested object with field-level validation
   */
  validateNestedObject<T extends Record<string, any>>(
    obj: unknown,
    schemaMap: { [K in keyof T]: z.ZodType<T[K], any, any> },
    context?: string
  ): ValidationResult & { data?: T; partialData?: Partial<T> } {
    if (!this.config.enableValidation) {
      return { success: true, data: obj as T };
    }

    if (!obj || typeof obj !== 'object') {
      return {
        success: false,
        errors: [{
          field: 'root',
          message: 'Expected object',
          code: 'invalid_type'
        } as ValidationErrorType]
      };
    }

    const errors: ValidationErrorType[] = [];
    const validatedData: Partial<T> = {};
    let hasAllFields = true;

    for (const [key, schema] of Object.entries(schemaMap)) {
      const value = (obj as any)[key];
      const validator = createValidator(schema, `${context || 'object'}.${key}`);
      const result = validator(value);
      
      if (result.success && result.data !== undefined) {
        validatedData[key as keyof T] = result.data;
      } else {
        hasAllFields = false;
        errors.push(...(result.errors || []));
      }
    }

    if (errors.length > 0 && this.config.logValidationErrors) {
      console.error(`Nested object validation failed${context ? ` for ${context}` : ''}:`, {
        errors,
        obj
      });
    }

    return {
      success: hasAllFields,
      data: hasAllFields ? validatedData as T : undefined,
      partialData: validatedData,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Validates API endpoint format
   */
  validateEndpoint(endpoint: unknown): ValidationResult & { data?: string } {
    if (!this.config.enableValidation) {
      return { success: true, data: endpoint as string };
    }

    const endpointSchema = z.string().refine(
      (endpoint) => endpoint.startsWith('/'),
      { message: 'Endpoint must start with /' }
    ).refine(
      (endpoint) => endpoint.length > 1,
      { message: 'Endpoint cannot be empty' }
    );

    const validator = createValidator(endpointSchema, 'API endpoint');
    return validator(endpoint);
  }

  /**
   * Validates HTTP method
   */
  validateHttpMethod(method: unknown): ValidationResult & { data?: string } {
    if (!this.config.enableValidation) {
      return { success: true, data: method as string };
    }

    const methodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    const validator = createValidator(methodSchema, 'HTTP method');
    return validator(method);
  }

  /**
   * Updates validator configuration
   */
  updateConfig(newConfig: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets current validator configuration
   */
  getConfig(): ValidatorConfig {
    return { ...this.config };
  }

  /**
   * Clears validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.validationCache.size,
      keys: Array.from(this.validationCache.keys())
    };
  }

  /**
   * Enables or disables validation
   */
  setValidationEnabled(enabled: boolean): void {
    this.config.enableValidation = enabled;
  }

  /**
   * Enables or disables strict mode
   */
  setStrictMode(enabled: boolean): void {
    this.config.strictMode = enabled;
  }
}

/**
 * Custom validation error class
 */
export class RuntimeValidationError extends Error {
  constructor(message: string, public validationErrors?: ValidationErrorType[]) {
    super(message);
    this.name = 'RuntimeValidationError';
  }
}

/**
 * Default runtime validator instance
 */
export const runtimeValidator = new RuntimeValidator();

/**
 * Factory function for creating configured validator instances
 */
export function createRuntimeValidator(config: Partial<ValidatorConfig> = {}): RuntimeValidator {
  return new RuntimeValidator(config);
}

/**
 * Convenience function for validating API responses
 */
export function validateApiResponseData<T>(
  response: unknown,
  dataSchema: z.ZodType<T, any, any>,
  endpoint?: string
): T {
  const result = runtimeValidator.validateApiResponse(response, dataSchema, endpoint);
  
  if (!result.success) {
    const errorMessage = result.errors?.map(err => `${err.field}: ${err.message}`).join(', ') || 'Validation failed';
    throw new RuntimeValidationError(`API response validation failed${endpoint ? ` for ${endpoint}` : ''}: ${errorMessage}`, result.errors);
  }

  if (result.data === undefined) {
    throw new RuntimeValidationError(`API response validation returned no data${endpoint ? ` for ${endpoint}` : ''}`);
  }

  return result.data;
}

/**
 * Convenience function for validating request payloads
 */
export function validateRequestPayloadData<T>(
  payload: unknown,
  schema: z.ZodType<T, any, any>,
  endpoint?: string
): T {
  const result = runtimeValidator.validateRequestPayload(payload, schema, endpoint);
  
  if (!result.success) {
    const errorMessage = result.errors?.map(err => `${err.field}: ${err.message}`).join(', ') || 'Validation failed';
    throw new RuntimeValidationError(`Request payload validation failed${endpoint ? ` for ${endpoint}` : ''}: ${errorMessage}`, result.errors);
  }

  if (result.data === undefined) {
    throw new RuntimeValidationError(`Request payload validation returned no data${endpoint ? ` for ${endpoint}` : ''}`);
  }

  return result.data;
}