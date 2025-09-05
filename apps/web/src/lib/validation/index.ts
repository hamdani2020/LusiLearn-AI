/**
 * Validation module exports
 * Provides comprehensive runtime validation for API interactions
 */

// Export all schemas
export * from './schemas';

// Export validation utilities
export * from './utils';

// Export runtime validator
export * from './runtime-validator';

// Export API validation middleware
export * from './api-validation-middleware';

// Export type-safe error handling
export * from './type-safe-errors';

// Export TypeScript utilities (excluding isTypeSafeApiError to avoid conflict)
export type {
  ExtractApiResponseData,
  ExtractBatchResponseData,
  ApiFunction,
  BatchApiFunction,
  Optional,
  Required,
  Nullable,
  UpdatePayload,
  CreatePayload,
  TypedApiClient
} from './typescript-utils';

export {
  isApiResponse,
  isSuccessfulApiResponse,
  isFailedApiResponse,
  isBatchResponse,
  isRequestOptions,
  isApiMetrics,
  isErrorType,
  assertSuccessfulApiResponse,
  assertRequestOptions,
  assertApiMetrics,
  extractApiResponseData,
  extractApiResponseError,
  createTypeSafeApiFunction,
  createTypeSafeBatchFunction,
  handleApiResponse,
  chainApiResponse,
  combineApiResponses
} from './typescript-utils';

// Re-export commonly used Zod utilities
export { z } from 'zod';

// Export type inference helpers
export type { ZodSchema, ZodType, ZodError } from 'zod';