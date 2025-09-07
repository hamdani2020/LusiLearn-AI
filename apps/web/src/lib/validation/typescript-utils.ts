/**
 * TypeScript utilities for enhanced type safety and IntelliSense support
 * Provides type guards, assertion functions, and utility types for API interactions
 */

import { z } from 'zod';
import { 
  ApiResponse, 
  BatchResponse, 
  RequestOptions, 
  ApiMetrics,
  ErrorType 
} from '../api-client/types';
import { TypeSafeApiError } from './type-safe-errors';

/**
 * Utility types for enhanced TypeScript integration
 */

/**
 * Extracts the data type from an ApiResponse
 */
export type ExtractApiResponseData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Extracts the data type from a BatchResponse
 */
export type ExtractBatchResponseData<T> = T extends BatchResponse<infer U> ? U : never;

/**
 * Creates a type-safe API function signature
 */
export type ApiFunction<TRequest, TResponse> = (
  data: TRequest,
  options?: RequestOptions
) => Promise<ApiResponse<TResponse>>;

/**
 * Creates a type-safe batch API function signature
 */
export type BatchApiFunction<TRequest, TResponse> = (
  requests: Array<{ id: string; data: TRequest; options?: RequestOptions }>
) => Promise<BatchResponse<TResponse>>;

/**
 * Utility type for optional fields
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for required fields
 */
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Utility type for nullable fields
 */
export type Nullable<T> = T | null;

/**
 * Utility type for creating update payloads
 */
export type UpdatePayload<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Utility type for creating create payloads
 */
export type CreatePayload<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type guard functions for runtime type checking
 */

/**
 * Type guard for ApiResponse
 * @param value - The value to check
 * @returns True if the value is a valid ApiResponse
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'success' in value! &&
    typeof (value as any).success === 'boolean'
  );
}

/**
 * Type guard for successful ApiResponse
 * @param response - The response to check
 * @returns True if the response is successful and has data
 */
export function isSuccessfulApiResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success && response.data !== undefined && response.data !== null;
}

/**
 * Type guard for failed ApiResponse
 * @param response - The response to check
 * @returns True if the response failed
 */
export function isFailedApiResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: false; error: string } {
  return !response.success;
}

/**
 * Type guard for BatchResponse
 * @param value - The value to check
 * @returns True if the value is a valid BatchResponse
 */
export function isBatchResponse<T>(value: unknown): value is BatchResponse<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'success' in value! &&
    'results' in value! &&
    Array.isArray((value as any).results)
  );
}

/**
 * Type guard for RequestOptions
 * @param value - The value to check
 * @returns True if the value is valid RequestOptions
 */
export function isRequestOptions(value: unknown): value is RequestOptions {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const obj = value as any;
  
  return (
    (obj.timeout === undefined || typeof obj.timeout === 'number') &&
    (obj.retries === undefined || typeof obj.retries === 'number') &&
    (obj.cache === undefined || typeof obj.cache === 'boolean') &&
    (obj.cacheTTL === undefined || typeof obj.cacheTTL === 'number') &&
    (obj.signal === undefined || obj.signal instanceof AbortSignal) &&
    (obj.headers === undefined || (typeof obj.headers === 'object' && obj.headers !== null))
  );
}

/**
 * Type guard for ApiMetrics
 * @param value - The value to check
 * @returns True if the value is valid ApiMetrics
 */
export function isApiMetrics(value: unknown): value is ApiMetrics {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const obj = value as any;
  
  return (
    typeof obj.totalRequests === 'number' &&
    typeof obj.successfulRequests === 'number' &&
    typeof obj.failedRequests === 'number' &&
    typeof obj.averageResponseTime === 'number' &&
    typeof obj.cacheHitRate === 'number' &&
    typeof obj.errorsByType === 'object' &&
    Array.isArray(obj.slowestEndpoints) &&
    typeof obj.requestsPerMinute === 'number' &&
    obj.lastReset instanceof Date
  );
}

/**
 * Type guard for ErrorType
 * @param value - The value to check
 * @returns True if the value is a valid ErrorType
 */
export function isErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && Object.values(ErrorType).includes(value as ErrorType);
}

/**
 * Type guard for TypeSafeApiError
 * @param value - The value to check
 * @returns True if the value is a valid TypeSafeApiError
 */
export function isTypeSafeApiError(value: unknown): value is TypeSafeApiError {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const obj = value as any;
  
  return (
    isErrorType(obj.type) &&
    typeof obj.message === 'string' &&
    obj.timestamp instanceof Date &&
    typeof obj.recoverable === 'boolean'
  );
}

/**
 * Assertion functions for runtime type checking
 */

/**
 * Asserts that a value is a successful ApiResponse
 * @param response - The response to assert
 * @param context - Optional context for error messages
 * @throws Error if the assertion fails
 */
export function assertSuccessfulApiResponse<T>(
  response: ApiResponse<T>,
  context?: string
): asserts response is ApiResponse<T> & { success: true; data: T } {
  if (!isSuccessfulApiResponse(response)) {
    const contextMsg = context ? ` for ${context}` : '';
    const errorMsg = response.error || 'Unknown error';
    throw new Error(`API response assertion failed${contextMsg}: ${errorMsg}`);
  }
}

/**
 * Asserts that a value is valid RequestOptions
 * @param options - The options to assert
 * @param context - Optional context for error messages
 * @throws Error if the assertion fails
 */
export function assertRequestOptions(
  options: unknown,
  context?: string
): asserts options is RequestOptions {
  if (!isRequestOptions(options)) {
    const contextMsg = context ? ` for ${context}` : '';
    throw new Error(`RequestOptions assertion failed${contextMsg}: Invalid options format`);
  }
}

/**
 * Asserts that a value is valid ApiMetrics
 * @param metrics - The metrics to assert
 * @param context - Optional context for error messages
 * @throws Error if the assertion fails
 */
export function assertApiMetrics(
  metrics: unknown,
  context?: string
): asserts metrics is ApiMetrics {
  if (!isApiMetrics(metrics)) {
    const contextMsg = context ? ` for ${context}` : '';
    throw new Error(`ApiMetrics assertion failed${contextMsg}: Invalid metrics format`);
  }
}

/**
 * Utility functions for type manipulation
 */

/**
 * Safely extracts data from an ApiResponse
 * @param response - The API response
 * @returns The data if successful, undefined otherwise
 */
export function extractApiResponseData<T>(response: ApiResponse<T>): T | undefined {
  return isSuccessfulApiResponse(response) ? response.data : undefined;
}

/**
 * Safely extracts error from an ApiResponse
 * @param response - The API response
 * @returns The error message if failed, undefined otherwise
 */
export function extractApiResponseError<T>(response: ApiResponse<T>): string | undefined {
  return isFailedApiResponse(response) ? response.error : undefined;
}

/**
 * Creates a type-safe wrapper for API functions
 * @param apiFunction - The API function to wrap
 * @param requestSchema - Zod schema for request validation
 * @param responseSchema - Zod schema for response validation
 * @returns Type-safe wrapped function
 */
export function createTypeSafeApiFunction<TRequest, TResponse>(
  apiFunction: (data: any, options?: RequestOptions) => Promise<ApiResponse<any>>,
  requestSchema: z.ZodType<TRequest, any, any>,
  responseSchema: z.ZodType<TResponse, any, any>
): ApiFunction<TRequest, TResponse> {
  return async (data: TRequest, options?: RequestOptions): Promise<ApiResponse<TResponse>> => {
    // Validate request data
    const validatedRequest = requestSchema.parse(data);
    
    // Call the API function
    const response = await apiFunction(validatedRequest, options);
    
    // Validate response data if successful
    if (isSuccessfulApiResponse(response)) {
      const validatedResponse = responseSchema.parse(response.data);
      return {
        ...response,
        data: validatedResponse
      };
    }
    
    return response;
  };
}

/**
 * Creates a type-safe wrapper for batch API functions
 * @param batchFunction - The batch API function to wrap
 * @param requestSchema - Zod schema for request validation
 * @param responseSchema - Zod schema for response validation
 * @returns Type-safe wrapped batch function
 */
export function createTypeSafeBatchFunction<TRequest, TResponse>(
  batchFunction: (requests: any[]) => Promise<BatchResponse<any>>,
  requestSchema: z.ZodType<TRequest, any, any>,
  responseSchema: z.ZodType<TResponse, any, any>
): BatchApiFunction<TRequest, TResponse> {
  return async (
    requests: Array<{ id: string; data: TRequest; options?: RequestOptions }>
  ): Promise<BatchResponse<TResponse>> => {
    // Validate all request data
    const validatedRequests = requests.map(req => ({
      ...req,
      data: requestSchema.parse(req.data)
    }));
    
    // Call the batch function
    const response = await batchFunction(validatedRequests);
    
    // Validate response data for successful results
    if (isBatchResponse(response)) {
      const validatedResults = response.results.map(result => {
        if (result.success && result.data !== undefined) {
          return {
            ...result,
            data: responseSchema.parse(result.data) as TResponse
          };
        }
        return result;
      });
      
      return {
        ...response,
        results: validatedResults as Array<{ id: string; success: boolean; data?: TResponse; error?: string }>
      };
    }
    
    return response;
  };
}

/**
 * Utility type for creating strongly typed API client methods
 */
export interface TypedApiClient {
  /**
   * Makes a GET request with type safety
   * @param endpoint - The API endpoint
   * @param options - Request options
   * @returns Promise resolving to typed response
   */
  get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  
  /**
   * Makes a POST request with type safety
   * @param endpoint - The API endpoint
   * @param data - Request payload
   * @param options - Request options
   * @returns Promise resolving to typed response
   */
  post<TRequest, TResponse>(
    endpoint: string, 
    data: TRequest, 
    options?: RequestOptions
  ): Promise<ApiResponse<TResponse>>;
  
  /**
   * Makes a PUT request with type safety
   * @param endpoint - The API endpoint
   * @param data - Request payload
   * @param options - Request options
   * @returns Promise resolving to typed response
   */
  put<TRequest, TResponse>(
    endpoint: string, 
    data: TRequest, 
    options?: RequestOptions
  ): Promise<ApiResponse<TResponse>>;
  
  /**
   * Makes a DELETE request with type safety
   * @param endpoint - The API endpoint
   * @param options - Request options
   * @returns Promise resolving to typed response
   */
  delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  
  /**
   * Makes a PATCH request with type safety
   * @param endpoint - The API endpoint
   * @param data - Request payload
   * @param options - Request options
   * @returns Promise resolving to typed response
   */
  patch<TRequest, TResponse>(
    endpoint: string, 
    data: TRequest, 
    options?: RequestOptions
  ): Promise<ApiResponse<TResponse>>;
}

/**
 * Type-safe error handling utilities
 */

/**
 * Handles API response with type-safe error handling
 * @param response - The API response
 * @param onSuccess - Success handler
 * @param onError - Error handler
 * @returns The result of the appropriate handler
 */
export function handleApiResponse<T, TSuccess, TError>(
  response: ApiResponse<T>,
  onSuccess: (data: T) => TSuccess,
  onError: (error: string) => TError
): TSuccess | TError {
  if (isSuccessfulApiResponse(response)) {
    return onSuccess(response.data);
  } else {
    return onError(response.error || 'Unknown error');
  }
}

/**
 * Chains API responses with type safety
 * @param response - The initial API response
 * @param transform - Function to transform successful response
 * @returns Transformed response or original error
 */
export function chainApiResponse<T, U>(
  response: ApiResponse<T>,
  transform: (data: T) => Promise<ApiResponse<U>>
): Promise<ApiResponse<U>> {
  if (isSuccessfulApiResponse(response)) {
    return transform(response.data);
  } else {
    return Promise.resolve(response as unknown as ApiResponse<U>);
  }
}

/**
 * Combines multiple API responses with type safety
 * @param responses - Array of API responses
 * @returns Combined response with all data or first error
 */
export function combineApiResponses<T extends readonly unknown[]>(
  responses: { [K in keyof T]: ApiResponse<T[K]> }
): ApiResponse<T> {
  const errors: string[] = [];
  const data: any[] = [];
  
  for (let i = 0; i < responses.length; i++) {
    const response = responses[i];
    if (isSuccessfulApiResponse(response)) {
      data[i] = response.data;
    } else {
      errors.push(response.error || `Error in response ${i}`);
    }
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join('; ')
    };
  }
  
  return {
    success: true,
    data: data as unknown as T
  };
}