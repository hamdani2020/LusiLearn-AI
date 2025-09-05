/**
 * Validation utilities for runtime type checking
 * Provides comprehensive validation functions with detailed error reporting
 */

import { z } from 'zod';
import { ApiValidationResult, ValidationError } from './schemas';

// Define ValidationResult type locally
export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
}

/**
 * Validates data against a Zod schema with detailed error reporting
 */
export function validateData<T>(
  data: unknown,
  schema: z.ZodType<T, any, any>,
  context?: string
): ValidationResult & { data?: T } {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationError[] = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        value: err.path.reduce((obj: any, key) => obj?.[key], data)
      }));

      return {
        success: false,
        errors: validationErrors
      };
    }

    return {
      success: false,
      errors: [{
        field: 'root',
        message: `Validation failed${context ? ` for ${context}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'unknown_error'
      }]
    };
  }
}

/**
 * Validates API response data with enhanced error reporting
 */
export function validateApiResponse<T>(
  response: unknown,
  dataSchema: z.ZodType<T, any, any>,
  endpoint?: string
): ValidationResult & { data?: T } {
  // First validate the response structure
  const responseSchema = z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    metadata: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      duration: z.number(),
      cached: z.boolean(),
      retryCount: z.number(),
      source: z.enum(['api', 'cache', 'optimistic'])
    }).optional(),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean()
    }).optional()
  });

  const responseValidation = validateData(response, responseSchema, `API response${endpoint ? ` from ${endpoint}` : ''}`);
  
  if (!responseValidation.success) {
    return responseValidation;
  }

  const validatedResponse = responseValidation.data!;

  // If response indicates failure, return the error
  if (!validatedResponse.success) {
    return {
      success: false,
      errors: [{
        field: 'api_error',
        message: validatedResponse.error || 'API request failed',
        code: 'api_error'
      }]
    };
  }

  // If response is successful but has no data, that might be expected (e.g., DELETE operations)
  if (validatedResponse.data === undefined || validatedResponse.data === null) {
    return {
      success: true,
      data: undefined
    };
  }

  // Validate the actual data
  return validateData(validatedResponse.data, dataSchema, `API response data${endpoint ? ` from ${endpoint}` : ''}`);
}

/**
 * Validates request payload before sending to API
 */
export function validateRequestPayload<T>(
  payload: unknown,
  schema: z.ZodType<T, any, any>,
  endpoint?: string
): ValidationResult & { data?: T } {
  return validateData(payload, schema, `request payload${endpoint ? ` for ${endpoint}` : ''}`);
}

/**
 * Creates a type-safe validation function for a specific schema
 */
export function createValidator<T>(schema: z.ZodType<T, any, any>, context?: string) {
  return (data: unknown): ValidationResult & { data?: T } => {
    return validateData(data, schema, context);
  };
}

/**
 * Validates an array of items against a schema
 */
export function validateArray<T>(
  items: unknown[],
  itemSchema: z.ZodType<T, any, any>,
  context?: string
): ValidationResult & { data?: T[] } {
  const arraySchema = z.array(itemSchema);
  return validateData(items, arraySchema, context);
}

/**
 * Validates pagination parameters
 */
export function validatePaginationParams(params: unknown): ValidationResult & { 
  data?: { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } 
} {
  const paginationSchema = z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  });

  return validateData(params, paginationSchema, 'pagination parameters');
}

/**
 * Validates query parameters for API requests
 */
export function validateQueryParams(params: unknown): ValidationResult & { data?: Record<string, string> } {
  const querySchema = z.record(z.string(), z.string());
  return validateData(params, querySchema, 'query parameters');
}

/**
 * Validates file upload parameters
 */
export function validateFileUpload(file: unknown): ValidationResult & { data?: File } {
  const fileSchema = z.instanceof(File).refine(
    (file) => file.size > 0,
    { message: 'File cannot be empty' }
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024, // 10MB limit
    { message: 'File size cannot exceed 10MB' }
  );

  return validateData(file, fileSchema, 'file upload');
}

/**
 * Validates WebSocket message format
 */
export function validateWebSocketMessage(message: unknown): ValidationResult & { 
  data?: { type: string; channel: string; data: any; timestamp: string; id?: string } 
} {
  const messageSchema = z.object({
    type: z.string(),
    channel: z.string(),
    data: z.any(),
    timestamp: z.string().datetime(),
    id: z.string().optional()
  });

  return validateData(message, messageSchema, 'WebSocket message');
}

/**
 * Validates cache configuration
 */
export function validateCacheConfig(config: unknown): ValidationResult & { 
  data?: { ttl: number; maxSize?: number; strategy?: string } 
} {
  const cacheConfigSchema = z.object({
    ttl: z.number().min(0),
    maxSize: z.number().min(1).optional(),
    strategy: z.enum(['lru', 'fifo', 'ttl']).optional()
  });

  return validateData(config, cacheConfigSchema, 'cache configuration');
}

/**
 * Validates authentication token
 */
export function validateAuthToken(token: unknown): ValidationResult & { data?: string } {
  const tokenSchema = z.string().min(1).refine(
    (token) => {
      // Basic JWT format validation (header.payload.signature)
      const parts = token.split('.');
      return parts.length === 3;
    },
    { message: 'Invalid JWT token format' }
  );

  return validateData(token, tokenSchema, 'authentication token');
}

/**
 * Validates API endpoint URL
 */
export function validateEndpoint(endpoint: unknown): ValidationResult & { data?: string } {
  const endpointSchema = z.string().refine(
    (endpoint) => endpoint.startsWith('/'),
    { message: 'Endpoint must start with /' }
  ).refine(
    (endpoint) => endpoint.length > 1,
    { message: 'Endpoint cannot be empty' }
  );

  return validateData(endpoint, endpointSchema, 'API endpoint');
}

/**
 * Validates HTTP method
 */
export function validateHttpMethod(method: unknown): ValidationResult & { 
  data?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' 
} {
  const methodSchema = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
  return validateData(method, methodSchema, 'HTTP method');
}

/**
 * Validates request headers
 */
export function validateHeaders(headers: unknown): ValidationResult & { data?: Record<string, string> } {
  const headersSchema = z.record(z.string(), z.string());
  return validateData(headers, headersSchema, 'request headers');
}

/**
 * Validates timeout value
 */
export function validateTimeout(timeout: unknown): ValidationResult & { data?: number } {
  const timeoutSchema = z.number().min(1000).max(300000); // 1s to 5min
  return validateData(timeout, timeoutSchema, 'timeout value');
}

/**
 * Validates retry configuration
 */
export function validateRetryConfig(config: unknown): ValidationResult & { 
  data?: { attempts: number; delay: number; backoff?: number } 
} {
  const retryConfigSchema = z.object({
    attempts: z.number().min(0).max(10),
    delay: z.number().min(100).max(30000),
    backoff: z.number().min(1).max(5).optional()
  });

  return validateData(config, retryConfigSchema, 'retry configuration');
}

/**
 * Validates error response format
 */
export function validateErrorResponse(error: unknown): ValidationResult & { 
  data?: { type: string; message: string; code?: string; status?: number } 
} {
  const errorSchema = z.object({
    type: z.string(),
    message: z.string(),
    code: z.string().optional(),
    status: z.number().min(100).max(599).optional(),
    details: z.any().optional(),
    timestamp: z.date(),
    requestId: z.string().optional(),
    recoverable: z.boolean(),
    retryAfter: z.number().min(0).optional()
  });

  return validateData(error, errorSchema, 'error response');
}

/**
 * Validates metrics data
 */
export function validateMetrics(metrics: unknown): ValidationResult & { 
  data?: { 
    totalRequests: number; 
    successfulRequests: number; 
    failedRequests: number; 
    averageResponseTime: number 
  } 
} {
  const metricsSchema = z.object({
    totalRequests: z.number().min(0),
    successfulRequests: z.number().min(0),
    failedRequests: z.number().min(0),
    averageResponseTime: z.number().min(0),
    cacheHitRate: z.number().min(0).max(1),
    errorsByType: z.record(z.string(), z.number().min(0)),
    slowestEndpoints: z.array(z.object({
      endpoint: z.string(),
      averageTime: z.number().min(0),
      requestCount: z.number().min(0)
    })),
    requestsPerMinute: z.number().min(0),
    lastReset: z.date()
  });

  return validateData(metrics, metricsSchema, 'API metrics');
}

/**
 * Type guard function generator
 */
export function createTypeGuard<T>(schema: z.ZodType<T, any, any>) {
  return (data: unknown): data is T => {
    try {
      schema.parse(data);
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Assertion function generator
 */
export function createAssertion<T>(schema: z.ZodType<T, any, any>, context?: string) {
  return (data: unknown): asserts data is T => {
    const result = validateData(data, schema, context);
    if (!result.success) {
      const errorMessage = result.errors?.map(err => `${err.field}: ${err.message}`).join(', ') || 'Validation failed';
      throw new Error(`Assertion failed${context ? ` for ${context}` : ''}: ${errorMessage}`);
    }
  };
}

/**
 * Safe parser that returns undefined on validation failure
 */
export function safeParse<T>(data: unknown, schema: z.ZodType<T, any, any>): T | undefined {
  try {
    return schema.parse(data);
  } catch {
    return undefined;
  }
}

/**
 * Validates and transforms data with default values
 */
export function validateWithDefaults<T>(
  data: unknown,
  schema: z.ZodType<T, any, any>,
  defaults: Partial<T>
): ValidationResult & { data?: T } {
  const result = validateData(data, schema);
  
  if (result.success && result.data) {
    return {
      success: true,
      data: { ...defaults, ...result.data }
    };
  }
  
  return result;
}

/**
 * Validates nested object properties
 */
export function validateNestedObject<T extends Record<string, any>>(
  obj: unknown,
  schemaMap: { [K in keyof T]: z.ZodType<T[K], any, any> }
): ValidationResult & { data?: T } {
  if (!obj || typeof obj !== 'object') {
    return {
      success: false,
      errors: [{
        field: 'root',
        message: 'Expected object',
        code: 'invalid_type'
      }]
    };
  }

  const errors: ValidationError[] = [];
  const validatedData: Partial<T> = {};

  for (const [key, schema] of Object.entries(schemaMap)) {
    const value = (obj as any)[key];
    const result = validateData(value, schema, key);
    
    if (result.success) {
      validatedData[key as keyof T] = result.data;
    } else {
      errors.push(...(result.errors || []));
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors
    };
  }

  return {
    success: true,
    data: validatedData as T
  };
}