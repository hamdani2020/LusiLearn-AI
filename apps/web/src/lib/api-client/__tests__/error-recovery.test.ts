import {
  NetworkErrorRecovery,
  AuthenticationErrorRecovery,
  RateLimitErrorRecovery,
  ServerErrorRecovery,
  ErrorRecoveryManager,
  EnhancedApiError,
  getUserFriendlyError
} from '../errors';
import { ErrorType, RequestContext } from '../types';

describe('Error Recovery System', () => {
  let mockContext: RequestContext;

  beforeEach(() => {
    mockContext = {
      requestId: 'test-request-123',
      endpoint: '/api/test',
      method: 'GET',
      retryCount: 0,
      startTime: new Date(),
      options: {}
    };
  });

  describe('NetworkErrorRecovery', () => {
    let recovery: NetworkErrorRecovery;

    beforeEach(() => {
      recovery = new NetworkErrorRecovery();
    });

    it('should identify recoverable network errors', () => {
      const networkError = new EnhancedApiError('Network error', ErrorType.NETWORK);
      const timeoutError = new EnhancedApiError('Timeout error', ErrorType.TIMEOUT);
      const authError = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION);

      expect(recovery.canRecover(networkError)).toBe(true);
      expect(recovery.canRecover(timeoutError)).toBe(true);
      expect(recovery.canRecover(authError)).toBe(false);
    });

    it('should implement exponential backoff with jitter', () => {
      const delay1 = recovery.getRetryDelay(0);
      const delay2 = recovery.getRetryDelay(1);
      const delay3 = recovery.getRetryDelay(2);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(30000); // Max delay cap
    });

    it('should recover from network errors within retry limit', async () => {
      const error = new EnhancedApiError('Network error', ErrorType.NETWORK, 0, null, 'req-123', true);
      
      mockContext.retryCount = 1;
      const canRecover = await recovery.recover(error, mockContext);
      
      expect(canRecover).toBe(true);
    });

    it('should not recover when retry limit exceeded', async () => {
      const error = new EnhancedApiError('Network error', ErrorType.NETWORK, 0, null, 'req-123', true);
      
      mockContext.retryCount = 3; // Exceeds maxRetries
      const canRecover = await recovery.recover(error, mockContext);
      
      expect(canRecover).toBe(false);
    });
  });

  describe('AuthenticationErrorRecovery', () => {
    let recovery: AuthenticationErrorRecovery;
    let mockRefreshToken: jest.Mock;

    beforeEach(() => {
      mockRefreshToken = jest.fn();
      recovery = new AuthenticationErrorRecovery(mockRefreshToken);
    });

    it('should identify recoverable authentication errors', () => {
      const authError = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION);
      const networkError = new EnhancedApiError('Network error', ErrorType.NETWORK);

      expect(recovery.canRecover(authError)).toBe(true);
      expect(recovery.canRecover(networkError)).toBe(false);
    });

    it('should recover from authentication errors with successful token refresh', async () => {
      mockRefreshToken.mockResolvedValueOnce('new-token-123');
      const error = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION, 401, null, 'req-123', true);
      
      const canRecover = await recovery.recover(error, mockContext);
      
      expect(canRecover).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should not recover when token refresh fails', async () => {
      mockRefreshToken.mockRejectedValueOnce(new Error('Refresh failed'));
      const error = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION, 401, null, 'req-123', true);
      
      const canRecover = await recovery.recover(error, mockContext);
      
      expect(canRecover).toBe(false);
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should not recover without refresh token callback', () => {
      const recoveryWithoutCallback = new AuthenticationErrorRecovery();
      const error = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION);

      expect(recoveryWithoutCallback.canRecover(error)).toBe(false);
    });
  });

  describe('RateLimitErrorRecovery', () => {
    let recovery: RateLimitErrorRecovery;

    beforeEach(() => {
      recovery = new RateLimitErrorRecovery();
    });

    it('should identify recoverable rate limit errors', () => {
      const rateLimitError = new EnhancedApiError('Rate limit', ErrorType.RATE_LIMIT);
      const networkError = new EnhancedApiError('Network error', ErrorType.NETWORK);

      expect(recovery.canRecover(rateLimitError)).toBe(true);
      expect(recovery.canRecover(networkError)).toBe(false);
    });

    it('should use retryAfter value when available', async () => {
      const error = new EnhancedApiError(
        'Rate limit exceeded',
        ErrorType.RATE_LIMIT,
        429,
        null,
        'req-123',
        true,
        1 // 1 second retry after for testing
      );
      
      const startTime = Date.now();
      const canRecover = await recovery.recover(error, mockContext);
      const endTime = Date.now();
      
      expect(canRecover).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000); // Should wait at least 1 second
    }, 10000); // Increase timeout to 10 seconds

    it('should implement linear backoff when no retryAfter is provided', () => {
      const delay1 = recovery.getRetryDelay(0);
      const delay2 = recovery.getRetryDelay(1);
      const delay3 = recovery.getRetryDelay(2);

      expect(delay1).toBe(5000);  // 5 seconds
      expect(delay2).toBe(10000); // 10 seconds
      expect(delay3).toBe(15000); // 15 seconds
    });

    it('should not exceed maximum delay', () => {
      const delay = recovery.getRetryDelay(20); // Very high attempt number
      expect(delay).toBeLessThanOrEqual(60000); // Max 60 seconds
    });
  });

  describe('ServerErrorRecovery', () => {
    let recovery: ServerErrorRecovery;

    beforeEach(() => {
      recovery = new ServerErrorRecovery();
    });

    it('should identify recoverable server errors', () => {
      const serverError = new EnhancedApiError('Server error', ErrorType.SERVER);
      const validationError = new EnhancedApiError('Validation error', ErrorType.VALIDATION);

      expect(recovery.canRecover(serverError)).toBe(true);
      expect(recovery.canRecover(validationError)).toBe(false);
    });

    it('should implement exponential backoff for server errors', () => {
      const delay1 = recovery.getRetryDelay(0);
      const delay2 = recovery.getRetryDelay(1);
      const delay3 = recovery.getRetryDelay(2);

      expect(delay1).toBe(2000);  // 2 seconds
      expect(delay2).toBe(4000);  // 4 seconds
      expect(delay3).toBe(8000);  // 8 seconds
    });

    it('should cap maximum delay', () => {
      const delay = recovery.getRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(15000); // Max 15 seconds
    });
  });

  describe('ErrorRecoveryManager', () => {
    let manager: ErrorRecoveryManager;
    let mockRefreshToken: jest.Mock;

    beforeEach(() => {
      mockRefreshToken = jest.fn();
      manager = new ErrorRecoveryManager(mockRefreshToken);
    });

    it('should attempt recovery with appropriate strategy', async () => {
      const networkError = new EnhancedApiError('Network error', ErrorType.NETWORK, 0, null, 'req-123', true);
      
      const canRecover = await manager.attemptRecovery(networkError, mockContext);
      
      expect(canRecover).toBe(true);
    });

    it('should handle authentication errors with token refresh', async () => {
      mockRefreshToken.mockResolvedValueOnce('new-token');
      const authError = new EnhancedApiError('Auth error', ErrorType.AUTHENTICATION, 401, null, 'req-123', true);
      
      const canRecover = await manager.attemptRecovery(authError, mockContext);
      
      expect(canRecover).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should return false for non-recoverable errors', async () => {
      const validationError = new EnhancedApiError('Validation error', ErrorType.VALIDATION, 400, null, 'req-123', false);
      
      const canRecover = await manager.attemptRecovery(validationError, mockContext);
      
      expect(canRecover).toBe(false);
    });

    it('should handle strategy failures gracefully', async () => {
      // Create a custom strategy that throws an error
      const faultyStrategy = {
        canRecover: () => true,
        recover: () => { throw new Error('Strategy failed'); },
        getRetryDelay: () => 1000,
        maxRetries: 1
      };

      manager.addStrategy(faultyStrategy);
      
      const error = new EnhancedApiError('Test error', ErrorType.UNKNOWN, 500, null, 'req-123', true);
      
      // Should not throw, but return false
      const canRecover = await manager.attemptRecovery(error, mockContext);
      expect(canRecover).toBe(false);
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should return appropriate message for network errors', () => {
      const networkError = new EnhancedApiError('Network error', ErrorType.NETWORK);
      const friendlyError = getUserFriendlyError(networkError);

      expect(friendlyError.title).toBe('Connection Problem');
      expect(friendlyError.message).toContain('internet connection');
      expect(friendlyError.action).toBe('Retry');
      expect(friendlyError.severity).toBe('error');
    });

    it('should return appropriate message for authentication errors', () => {
      const authError = new EnhancedApiError('Auth failed', ErrorType.AUTHENTICATION);
      const friendlyError = getUserFriendlyError(authError);

      expect(friendlyError.title).toBe('Session Expired');
      expect(friendlyError.message).toContain('log in again');
      expect(friendlyError.action).toBe('Log In');
      expect(friendlyError.severity).toBe('warning');
    });

    it('should return appropriate message for rate limit errors', () => {
      const rateLimitError = new EnhancedApiError('Rate limit', ErrorType.RATE_LIMIT);
      const friendlyError = getUserFriendlyError(rateLimitError);

      expect(friendlyError.title).toBe('Too Many Requests');
      expect(friendlyError.message).toContain('too quickly');
      expect(friendlyError.severity).toBe('info');
    });

    it('should return appropriate message for validation errors', () => {
      const validationError = new EnhancedApiError('Validation failed', ErrorType.VALIDATION);
      const friendlyError = getUserFriendlyError(validationError);

      expect(friendlyError.title).toBe('Invalid Data');
      expect(friendlyError.message).toContain('check your input');
      expect(friendlyError.severity).toBe('warning');
    });

    it('should return appropriate message for server errors', () => {
      const serverError = new EnhancedApiError('Server error', ErrorType.SERVER);
      const friendlyError = getUserFriendlyError(serverError);

      expect(friendlyError.title).toBe('Server Error');
      expect(friendlyError.message).toContain('our end');
      expect(friendlyError.action).toBe('Retry');
      expect(friendlyError.severity).toBe('error');
    });

    it('should return default message for unknown errors', () => {
      const unknownError = new EnhancedApiError('Unknown error', ErrorType.UNKNOWN);
      const friendlyError = getUserFriendlyError(unknownError);

      expect(friendlyError.title).toBe('Unexpected Error');
      expect(friendlyError.message).toContain('unexpected error');
      expect(friendlyError.action).toBe('Retry');
      expect(friendlyError.severity).toBe('error');
    });

    it('should handle errors with specific codes', () => {
      const errorWithCode = new EnhancedApiError('Custom error', ErrorType.NETWORK);
      errorWithCode.code = 'CUSTOM_CODE';
      
      const friendlyError = getUserFriendlyError(errorWithCode);
      
      // Should fall back to generic network error message
      expect(friendlyError.title).toBe('Connection Problem');
    });
  });

  describe('Error Classification', () => {
    it('should correctly classify HTTP status codes', () => {
      // Mock response objects
      const responses = [
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 408, statusText: 'Request Timeout' },
        { status: 429, statusText: 'Too Many Requests', headers: new Map([['Retry-After', '60']]) },
        { status: 400, statusText: 'Bad Request' },
        { status: 422, statusText: 'Unprocessable Entity' },
        { status: 500, statusText: 'Internal Server Error' },
        { status: 502, statusText: 'Bad Gateway' },
        { status: 503, statusText: 'Service Unavailable' },
        { status: 504, statusText: 'Gateway Timeout' }
      ];

      const expectedTypes = [
        ErrorType.AUTHENTICATION,
        ErrorType.AUTHORIZATION,
        ErrorType.TIMEOUT,
        ErrorType.RATE_LIMIT,
        ErrorType.VALIDATION,
        ErrorType.VALIDATION,
        ErrorType.SERVER,
        ErrorType.SERVER,
        ErrorType.SERVER,
        ErrorType.TIMEOUT
      ];

      responses.forEach((response, index) => {
        const mockResponse = {
          ...response,
          headers: response.headers || new Map(),
          get: function(key: string) { return this.headers.get(key); }
        } as any;

        const error = EnhancedApiError.fromResponse(mockResponse, 'test-req');
        expect(error.type).toBe(expectedTypes[index]);
      });
    });

    it('should mark appropriate errors as recoverable', () => {
      const recoverableStatuses = [401, 408, 429, 500, 502, 503, 504];
      const nonRecoverableStatuses = [400, 403, 422];

      recoverableStatuses.forEach(status => {
        const mockResponse = {
          status,
          statusText: 'Test',
          headers: new Map(),
          get: function(key: string) { return this.headers.get(key); }
        } as any;

        const error = EnhancedApiError.fromResponse(mockResponse, 'test-req');
        expect(error.recoverable).toBe(true);
      });

      nonRecoverableStatuses.forEach(status => {
        const mockResponse = {
          status,
          statusText: 'Test',
          headers: new Map(),
          get: function(key: string) { return this.headers.get(key); }
        } as any;

        const error = EnhancedApiError.fromResponse(mockResponse, 'test-req');
        expect(error.recoverable).toBe(false);
      });
    });

    it('should extract retry-after header for rate limit errors', () => {
      const mockResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['Retry-After', '120']]),
        get: function(key: string) { return this.headers.get(key); }
      } as any;

      const error = EnhancedApiError.fromResponse(mockResponse, 'test-req');
      expect(error.type).toBe(ErrorType.RATE_LIMIT);
      expect(error.retryAfter).toBe(120);
    });
  });
});