/**
 * Comprehensive tests for the validation system
 * Tests runtime validation, type safety, and error handling
 */

import { z } from 'zod';
import {
  validateData,
  validateApiResponse,
  validateRequestPayload,
  createValidator,
  validateArray,
  validatePaginationParams,
  validateFileUpload,
  validateWebSocketMessage,
  createTypeGuard,
  createAssertion,
  safeParse
} from '../utils';
import {
  RuntimeValidator,
  ValidationError,
  createRuntimeValidator,
  validateApiResponseData,
  validateRequestPayloadData
} from '../runtime-validator';
import {
  ApiValidationMiddleware,
  createApiValidationMiddleware
} from '../api-validation-middleware';
import {
  TypeSafeErrorHandler,
  createTypeSafeErrorHandler,
  handleTypeSafeError,
  isTypeSafeApiError,
  createTypedError
} from '../type-safe-errors';
import {
  isApiResponse,
  isSuccessfulApiResponse,
  isFailedApiResponse,
  assertSuccessfulApiResponse,
  extractApiResponseData,
  handleApiResponse,
  combineApiResponses
} from '../typescript-utils';
import { ErrorType } from '../../api-client/types';

describe('Validation Utils', () => {
  const testSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    age: z.number().min(0).max(150),
    email: z.string().email()
  });

  describe('validateData', () => {
    it('should validate correct data successfully', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = validateData(validData, testSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.errors).toBeUndefined();
    });

    it('should return validation errors for invalid data', () => {
      const invalidData = {
        id: 'invalid-uuid',
        name: '',
        age: -5,
        email: 'invalid-email'
      };

      const result = validateData(invalidData, testSchema);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      
      const errorFields = result.errors!.map(err => err.field);
      expect(errorFields).toContain('id');
      expect(errorFields).toContain('name');
      expect(errorFields).toContain('age');
      expect(errorFields).toContain('email');
    });

    it('should handle non-object data gracefully', () => {
      const result = validateData('not an object', testSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].field).toBe('root');
    });
  });

  describe('validateApiResponse', () => {
    const dataSchema = z.object({
      message: z.string()
    });

    it('should validate successful API response', () => {
      const response = {
        success: true,
        data: { message: 'Hello World' },
        metadata: {
          requestId: 'req-123',
          timestamp: '2023-01-01T00:00:00Z',
          duration: 100,
          cached: false,
          retryCount: 0,
          source: 'api' as const
        }
      };

      const result = validateApiResponse(response, dataSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello World' });
    });

    it('should handle failed API response', () => {
      const response = {
        success: false,
        error: 'Something went wrong'
      };

      const result = validateApiResponse(response, dataSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('api_error');
    });

    it('should validate response with no data', () => {
      const response = {
        success: true,
        data: null
      };

      const result = validateApiResponse(response, dataSchema);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe('createValidator', () => {
    it('should create reusable validator function', () => {
      const validator = createValidator(testSchema, 'test context');
      
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = validator(validData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });
  });

  describe('validateArray', () => {
    it('should validate array of items', () => {
      const itemSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      const result = validateArray(items, itemSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
    });

    it('should return errors for invalid array items', () => {
      const itemSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      const items = [
        { id: 'invalid', name: 'Item 1' },
        { id: 2, name: 123 }
      ];

      const result = validateArray(items, itemSchema);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validatePaginationParams', () => {
    it('should validate correct pagination params', () => {
      const params = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc' as const
      };

      const result = validatePaginationParams(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(params);
    });

    it('should apply defaults for missing params', () => {
      const params = {};

      const result = validatePaginationParams(params);

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(20);
    });

    it('should reject invalid pagination params', () => {
      const params = {
        page: 0,
        limit: 200
      };

      const result = validatePaginationParams(params);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateFileUpload', () => {
    it('should validate valid file', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });

      const result = validateFileUpload(file);

      expect(result.success).toBe(true);
      expect(result.data).toBe(file);
    });

    it('should reject non-file objects', () => {
      const result = validateFileUpload('not a file');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('createTypeGuard', () => {
    it('should create working type guard', () => {
      const isTestObject = createTypeGuard(testSchema);

      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      expect(isTestObject(validData)).toBe(true);
      expect(isTestObject({ invalid: 'data' })).toBe(false);
    });
  });

  describe('createAssertion', () => {
    it('should create working assertion function', () => {
      const assertTestObject = createAssertion(testSchema, 'test object');

      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      expect(() => assertTestObject(validData)).not.toThrow();
      expect(() => assertTestObject({ invalid: 'data' })).toThrow();
    });
  });

  describe('safeParse', () => {
    it('should return parsed data on success', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const result = safeParse(validData, testSchema);

      expect(result).toEqual(validData);
    });

    it('should return undefined on failure', () => {
      const result = safeParse({ invalid: 'data' }, testSchema);

      expect(result).toBeUndefined();
    });
  });
});

describe('RuntimeValidator', () => {
  let validator: RuntimeValidator;

  beforeEach(() => {
    validator = createRuntimeValidator({
      enableValidation: true,
      strictMode: true,
      logValidationErrors: false,
      throwOnValidationError: false
    });
  });

  describe('validateApiResponse', () => {
    const dataSchema = z.object({
      message: z.string()
    });

    it('should validate successful response', () => {
      const response = {
        success: true,
        data: { message: 'Hello' }
      };

      const result = validator.validateApiResponse(response, dataSchema);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello' });
    });

    it('should handle validation disabled', () => {
      validator.setValidationEnabled(false);

      const response = { invalid: 'response' };
      const result = validator.validateApiResponse(response, dataSchema);

      expect(result.success).toBe(true);
      expect(result.data).toBe(response);
    });
  });

  describe('validateWithRecovery', () => {
    it('should return validated data on success', () => {
      const schema = z.string();
      const result = validator.validateWithRecovery('valid string', schema, 'fallback');

      expect(result).toBe('valid string');
    });

    it('should return fallback on validation failure', () => {
      const schema = z.string();
      const result = validator.validateWithRecovery(123, schema, 'fallback');

      expect(result).toBe('fallback');
    });
  });

  describe('validateArrayWithPartialSuccess', () => {
    it('should separate valid and invalid items', () => {
      const itemSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      const items = [
        { id: 1, name: 'Valid' },
        { id: 'invalid', name: 'Invalid ID' },
        { id: 2, name: 'Also Valid' }
      ];

      const result = validator.validateArrayWithPartialSuccess(items, itemSchema);

      expect(result.validItems).toHaveLength(2);
      expect(result.invalidItems).toHaveLength(1);
      expect(result.validItems[0]).toEqual({ id: 1, name: 'Valid' });
      expect(result.validItems[1]).toEqual({ id: 2, name: 'Also Valid' });
      expect(result.invalidItems[0].index).toBe(1);
    });
  });

  describe('createCachedValidator', () => {
    it('should create and cache validator', () => {
      const schema = z.string();
      const cachedValidator = validator.createCachedValidator(schema, 'test-key');

      const result1 = cachedValidator('valid string');
      const result2 = cachedValidator('another string');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const stats = validator.getCacheStats();
      expect(stats.keys).toContain('test-key');
    });
  });
});

describe('TypeSafeErrorHandler', () => {
  let errorHandler: TypeSafeErrorHandler;

  beforeEach(() => {
    errorHandler = createTypeSafeErrorHandler();
  });

  describe('handleError', () => {
    it('should handle ValidationError', () => {
      const validationError = new ValidationError('Validation failed', [
        { field: 'name', message: 'Required', code: 'required' }
      ]);

      const result = errorHandler.handleError(validationError);

      expect(result.type).toBe(ErrorType.VALIDATION);
      expect(result.message).toBe('Validation failed');
      expect(result.validationErrors).toBeDefined();
      expect(result.recoverable).toBe(false);
    });

    it('should handle standard Error objects', () => {
      const error = new Error('Network connection failed');

      const result = errorHandler.handleError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.message).toBe('Network connection failed');
      expect(result.recoverable).toBe(true);
    });

    it('should handle string errors', () => {
      const result = errorHandler.handleError('Something went wrong');

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('Something went wrong');
      expect(result.recoverable).toBe(false);
    });

    it('should handle unknown error types', () => {
      const result = errorHandler.handleError({ weird: 'object' });

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.recoverable).toBe(false);
    });
  });

  describe('createUserFriendlyMessage', () => {
    it('should create user-friendly messages for different error types', () => {
      const networkError = createTypedError(ErrorType.NETWORK, 'Connection failed');
      const authError = createTypedError(ErrorType.AUTHENTICATION, 'Token expired');
      const validationError = createTypedError(ErrorType.VALIDATION, 'Invalid input', {
        validationErrors: [
          { field: 'email', message: 'Invalid format', code: 'invalid_format' }
        ]
      });

      expect(errorHandler.createUserFriendlyMessage(networkError))
        .toContain('internet connection');
      expect(errorHandler.createUserFriendlyMessage(authError))
        .toContain('log in again');
      expect(errorHandler.createUserFriendlyMessage(validationError))
        .toContain('email: Invalid format');
    });
  });

  describe('getRecoveryActions', () => {
    it('should provide appropriate recovery actions', () => {
      const networkError = createTypedError(ErrorType.NETWORK, 'Connection failed');
      const authError = createTypedError(ErrorType.AUTHENTICATION, 'Token expired');

      const networkActions = errorHandler.getRecoveryActions(networkError);
      const authActions = errorHandler.getRecoveryActions(authError);

      expect(networkActions).toContain('Check your internet connection');
      expect(authActions).toContain('Log in again');
    });
  });

  describe('registerErrorHandler', () => {
    it('should register and execute custom error handlers', () => {
      const mockHandler = jest.fn();
      errorHandler.registerErrorHandler(ErrorType.NETWORK, mockHandler);

      const networkError = createTypedError(ErrorType.NETWORK, 'Connection failed');
      errorHandler.handleError(networkError);

      expect(mockHandler).toHaveBeenCalledWith(networkError, undefined);
    });
  });
});

describe('TypeScript Utils', () => {
  describe('Type Guards', () => {
    describe('isApiResponse', () => {
      it('should identify valid API responses', () => {
        const validResponse = {
          success: true,
          data: { message: 'Hello' }
        };

        const invalidResponse = {
          notSuccess: true
        };

        expect(isApiResponse(validResponse)).toBe(true);
        expect(isApiResponse(invalidResponse)).toBe(false);
        expect(isApiResponse(null)).toBe(false);
        expect(isApiResponse('string')).toBe(false);
      });
    });

    describe('isSuccessfulApiResponse', () => {
      it('should identify successful responses with data', () => {
        const successfulResponse = {
          success: true,
          data: { message: 'Hello' }
        };

        const failedResponse = {
          success: false,
          error: 'Failed'
        };

        const successfulNoData = {
          success: true,
          data: null
        };

        expect(isSuccessfulApiResponse(successfulResponse)).toBe(true);
        expect(isSuccessfulApiResponse(failedResponse)).toBe(false);
        expect(isSuccessfulApiResponse(successfulNoData)).toBe(false);
      });
    });

    describe('isFailedApiResponse', () => {
      it('should identify failed responses', () => {
        const successfulResponse = {
          success: true,
          data: { message: 'Hello' }
        };

        const failedResponse = {
          success: false,
          error: 'Failed'
        };

        expect(isFailedApiResponse(successfulResponse)).toBe(false);
        expect(isFailedApiResponse(failedResponse)).toBe(true);
      });
    });
  });

  describe('Assertion Functions', () => {
    describe('assertSuccessfulApiResponse', () => {
      it('should pass for successful responses', () => {
        const successfulResponse = {
          success: true,
          data: { message: 'Hello' }
        };

        expect(() => assertSuccessfulApiResponse(successfulResponse)).not.toThrow();
      });

      it('should throw for failed responses', () => {
        const failedResponse = {
          success: false,
          error: 'Failed'
        };

        expect(() => assertSuccessfulApiResponse(failedResponse)).toThrow();
      });
    });
  });

  describe('Utility Functions', () => {
    describe('extractApiResponseData', () => {
      it('should extract data from successful response', () => {
        const response = {
          success: true,
          data: { message: 'Hello' }
        };

        const data = extractApiResponseData(response);

        expect(data).toEqual({ message: 'Hello' });
      });

      it('should return undefined for failed response', () => {
        const response = {
          success: false,
          error: 'Failed'
        };

        const data = extractApiResponseData(response);

        expect(data).toBeUndefined();
      });
    });

    describe('handleApiResponse', () => {
      it('should call success handler for successful response', () => {
        const response = {
          success: true,
          data: { message: 'Hello' }
        };

        const result = handleApiResponse(
          response,
          (data) => `Success: ${data.message}`,
          (error) => `Error: ${error}`
        );

        expect(result).toBe('Success: Hello');
      });

      it('should call error handler for failed response', () => {
        const response = {
          success: false,
          error: 'Failed'
        };

        const result = handleApiResponse(
          response,
          (data) => `Success: ${data}`,
          (error) => `Error: ${error}`
        );

        expect(result).toBe('Error: Failed');
      });
    });

    describe('combineApiResponses', () => {
      it('should combine successful responses', () => {
        const responses = [
          { success: true, data: 'first' },
          { success: true, data: 'second' }
        ] as const;

        const result = combineApiResponses(responses);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(['first', 'second']);
      });

      it('should return error if any response failed', () => {
        const responses = [
          { success: true, data: 'first' },
          { success: false, error: 'Failed' }
        ] as const;

        const result = combineApiResponses(responses);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed');
      });
    });
  });
});

describe('Integration Tests', () => {
  describe('End-to-End Validation Flow', () => {
    it('should validate complete API request/response cycle', async () => {
      // Mock API client
      const mockClient = {
        post: jest.fn().mockResolvedValue({
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      };

      // Create validation middleware
      const middleware = createApiValidationMiddleware({
        validateRequests: true,
        validateResponses: true,
        throwOnValidationError: false
      });

      // Register schemas
      const userSchema = z.object({
        id: z.string().uuid(),
        name: z.string(),
        email: z.string().email()
      });

      middleware.registerSchema('/api/users', 'POST', {
        request: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        response: userSchema
      });

      // Test request validation
      const requestData = {
        name: 'Test User',
        email: 'test@example.com'
      };

      const requestContext = {
        requestId: 'req-123',
        endpoint: '/api/users',
        method: 'POST',
        retryCount: 0,
        startTime: new Date(),
        options: {}
      };

      const requestConfig = {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' }
      };

      // Validate request
      const validatedRequest = await middleware.onRequest(requestConfig, requestContext);
      expect(validatedRequest.body).toBe(JSON.stringify(requestData));

      // Mock response
      const mockResponse = new Response(JSON.stringify({
        success: true,
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test User',
          email: 'test@example.com'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      // Validate response
      const validatedResponse = await middleware.onResponse(mockResponse, requestContext);
      expect(validatedResponse.status).toBe(200);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle validation errors in API flow', () => {
      const errorHandler = createTypeSafeErrorHandler();
      const validator = createRuntimeValidator({
        throwOnValidationError: false
      });

      // Test validation error
      const invalidData = {
        name: '', // Invalid: empty string
        email: 'invalid-email' // Invalid: not an email
      };

      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email()
      });

      const validationResult = validator.validateRequestPayload(invalidData, schema);
      expect(validationResult.success).toBe(false);

      // Handle the validation error
      const validationError = new ValidationError('Validation failed', validationResult.errors);
      const handledError = errorHandler.handleError(validationError);

      expect(handledError.type).toBe(ErrorType.VALIDATION);
      expect(handledError.validationErrors).toBeDefined();
      expect(handledError.recoverable).toBe(false);

      // Get user-friendly message
      const userMessage = errorHandler.createUserFriendlyMessage(handledError);
      expect(userMessage).toContain('check your input');
    });
  });
});

// Helper function to create mock File objects for testing
function createMockFile(name: string, size: number, type: string = 'text/plain'): File {
  const content = 'x'.repeat(size);
  return new File([content], name, { type });
}