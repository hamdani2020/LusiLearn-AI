import { ErrorType, ApiError, RequestContext, ErrorRecoveryStrategy } from './types';

// Enhanced API Error class
export class EnhancedApiError extends Error implements ApiError {
  public readonly type: ErrorType;
  public readonly code?: string;
  public readonly status?: number;
  public readonly details?: any;
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly recoverable: boolean;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    status?: number,
    details?: any,
    requestId?: string,
    recoverable: boolean = false,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'EnhancedApiError';
    this.type = type;
    this.status = status;
    this.details = details;
    this.timestamp = new Date();
    this.requestId = requestId;
    this.recoverable = recoverable;
    this.retryAfter = retryAfter;
  }

  static fromResponse(response: Response, requestId?: string): EnhancedApiError {
    let type: ErrorType;
    let recoverable = false;
    let retryAfter: number | undefined;

    // Determine error type based on status code
    switch (response.status) {
      case 401:
        type = ErrorType.AUTHENTICATION;
        recoverable = true;
        break;
      case 403:
        type = ErrorType.AUTHORIZATION;
        break;
      case 408:
      case 504:
        type = ErrorType.TIMEOUT;
        recoverable = true;
        break;
      case 429:
        type = ErrorType.RATE_LIMIT;
        recoverable = true;
        retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        break;
      case 400:
      case 422:
        type = ErrorType.VALIDATION;
        break;
      case 500:
      case 502:
      case 503:
        type = ErrorType.SERVER;
        recoverable = true;
        break;
      default:
        type = ErrorType.UNKNOWN;
        recoverable = response.status >= 500;
    }

    return new EnhancedApiError(
      `HTTP ${response.status}: ${response.statusText}`,
      type,
      response.status,
      null,
      requestId,
      recoverable,
      retryAfter
    );
  }

  static fromNetworkError(error: Error, requestId?: string): EnhancedApiError {
    return new EnhancedApiError(
      `Network error: ${error.message}`,
      ErrorType.NETWORK,
      0,
      error,
      requestId,
      true
    );
  }

  static fromTimeout(requestId?: string): EnhancedApiError {
    return new EnhancedApiError(
      'Request timeout',
      ErrorType.TIMEOUT,
      408,
      null,
      requestId,
      true
    );
  }
}

// Network Error Recovery Strategy
export class NetworkErrorRecovery implements ErrorRecoveryStrategy {
  maxRetries = 3;

  canRecover(error: ApiError): boolean {
    return error.type === ErrorType.NETWORK || error.type === ErrorType.TIMEOUT;
  }

  async recover(error: ApiError, context: RequestContext): Promise<boolean> {
    if (context.retryCount >= this.maxRetries) {
      return false;
    }

    const delay = this.getRetryDelay(context.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }
}

// Authentication Error Recovery Strategy
export class AuthenticationErrorRecovery implements ErrorRecoveryStrategy {
  maxRetries = 1;
  private refreshTokenCallback?: () => Promise<string>;

  constructor(refreshTokenCallback?: () => Promise<string>) {
    this.refreshTokenCallback = refreshTokenCallback;
  }

  canRecover(error: ApiError): boolean {
    return error.type === ErrorType.AUTHENTICATION && !!this.refreshTokenCallback;
  }

  async recover(error: ApiError, context: RequestContext): Promise<boolean> {
    if (context.retryCount >= this.maxRetries || !this.refreshTokenCallback) {
      this.redirectToLogin();
      return false;
    }

    try {
      await this.refreshTokenCallback();
      return true;
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      this.redirectToLogin();
      return false;
    }
  }

  getRetryDelay(): number {
    return 0; // No delay for auth retry
  }

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      // Clear tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Redirect to login
      setTimeout(() => {
        window.location.href = '/auth';
      }, 0);
    }
  }
}

// Rate Limit Error Recovery Strategy
export class RateLimitErrorRecovery implements ErrorRecoveryStrategy {
  maxRetries = 3;

  canRecover(error: ApiError): boolean {
    return error.type === ErrorType.RATE_LIMIT;
  }

  async recover(error: ApiError, context: RequestContext): Promise<boolean> {
    if (context.retryCount >= this.maxRetries) {
      return false;
    }

    const delay = error.retryAfter ? error.retryAfter * 1000 : this.getRetryDelay(context.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  getRetryDelay(attempt: number): number {
    // Linear backoff for rate limits
    return Math.min(5000 * (attempt + 1), 60000);
  }
}

// Server Error Recovery Strategy
export class ServerErrorRecovery implements ErrorRecoveryStrategy {
  maxRetries = 2;

  canRecover(error: ApiError): boolean {
    return error.type === ErrorType.SERVER;
  }

  async recover(error: ApiError, context: RequestContext): Promise<boolean> {
    if (context.retryCount >= this.maxRetries) {
      return false;
    }

    const delay = this.getRetryDelay(context.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
  }

  getRetryDelay(attempt: number): number {
    // Exponential backoff for server errors
    return Math.min(2000 * Math.pow(2, attempt), 15000);
  }
}

// Error Recovery Manager
export class ErrorRecoveryManager {
  private strategies: ErrorRecoveryStrategy[] = [];

  constructor(refreshTokenCallback?: () => Promise<string>) {
    this.strategies = [
      new NetworkErrorRecovery(),
      new AuthenticationErrorRecovery(refreshTokenCallback),
      new RateLimitErrorRecovery(),
      new ServerErrorRecovery()
    ];
  }

  addStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  async attemptRecovery(error: ApiError, context: RequestContext): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error)) {
        try {
          const recovered = await strategy.recover(error, context);
          if (recovered) {
            return true;
          }
        } catch (recoveryError) {
          console.error('Error recovery failed:', recoveryError);
        }
      }
    }
    return false;
  }
}

// User-friendly error messages
export interface ErrorMessageConfig {
  [key: string]: {
    title: string;
    message: string;
    action?: string;
    severity: 'info' | 'warning' | 'error';
  };
}

export const errorMessages: ErrorMessageConfig = {
  'NETWORK_ERROR': {
    title: 'Connection Problem',
    message: 'Unable to connect to the server. Please check your internet connection.',
    action: 'Retry',
    severity: 'error'
  },
  'AUTHENTICATION_FAILED': {
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again.',
    action: 'Log In',
    severity: 'warning'
  },
  'AUTHORIZATION_DENIED': {
    title: 'Access Denied',
    message: 'You don\'t have permission to access this resource.',
    severity: 'error'
  },
  'VALIDATION_ERROR': {
    title: 'Invalid Data',
    message: 'Please check your input and try again.',
    severity: 'warning'
  },
  'RATE_LIMIT_EXCEEDED': {
    title: 'Too Many Requests',
    message: 'You\'re making requests too quickly. Please wait a moment.',
    severity: 'info'
  },
  'SERVER_ERROR': {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    action: 'Retry',
    severity: 'error'
  },
  'TIMEOUT_ERROR': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    action: 'Retry',
    severity: 'warning'
  },
  'UNKNOWN_ERROR': {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
    action: 'Retry',
    severity: 'error'
  }
};

export function getUserFriendlyError(error: ApiError): ErrorMessageConfig[string] {
  const key = `${error.type.toUpperCase()}_${error.code ? error.code.toUpperCase() : 'ERROR'}`;
  return errorMessages[key] || errorMessages[`${error.type.toUpperCase()}_ERROR`] || errorMessages['UNKNOWN_ERROR'];
}