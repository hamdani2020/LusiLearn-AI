/**
 * Type-safe error handling with proper TypeScript inference
 * Provides comprehensive error handling with validation and type safety
 */

import { z } from 'zod';
import { ErrorType } from '../api-client/types';
import { RuntimeValidationError } from './runtime-validator';
import { ValidationResult } from './utils';
import { ValidationError as ValidationErrorType } from './schemas';

/**
 * Enhanced error types with validation support
 */
export interface TypeSafeApiError {
  type: ErrorType;
  message: string;
  code?: string;
  status?: number;
  details?: any;
  timestamp: Date;
  requestId?: string;
  recoverable: boolean;
  retryAfter?: number;
  validationErrors?: ValidationErrorType[];
}

/**
 * Error classification schema
 */
export const ErrorClassificationSchema = z.object({
  type: z.nativeEnum(ErrorType),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['network', 'client', 'server', 'validation', 'business']),
  recoverable: z.boolean(),
  userFriendly: z.boolean()
});

export type ErrorClassification = z.infer<typeof ErrorClassificationSchema>;

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  endpoint?: string;
  method?: string;
  requestId?: string;
  userId?: string;
  timestamp: Date;
  userAgent?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

/**
 * Type-safe error handler class
 */
export class TypeSafeErrorHandler {
  private errorClassifications = new Map<string, ErrorClassification>();
  private errorHandlers = new Map<ErrorType, (error: TypeSafeApiError, context?: ErrorContext) => void>();
  private globalErrorHandler?: (error: TypeSafeApiError, context?: ErrorContext) => void;

  constructor() {
    this.initializeDefaultClassifications();
  }

  /**
   * Handles errors with type safety and validation
   */
  handleError(
    error: unknown,
    context?: ErrorContext
  ): TypeSafeApiError {
    const typeSafeError = this.normalizeError(error, context);
    const classification = this.classifyError(typeSafeError);

    // Log error based on severity
    this.logError(typeSafeError, classification, context);

    // Execute specific handler if available
    const handler = this.errorHandlers.get(typeSafeError.type);
    if (handler) {
      try {
        handler(typeSafeError, context);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Execute global handler if available
    if (this.globalErrorHandler) {
      try {
        this.globalErrorHandler(typeSafeError, context);
      } catch (handlerError) {
        console.error('Global error handler failed:', handlerError);
      }
    }

    return typeSafeError;
  }

  /**
   * Normalizes various error types into TypeSafeApiError
   */
  private normalizeError(error: unknown, context?: ErrorContext): TypeSafeApiError {
    const timestamp = new Date();
    const requestId = context?.requestId || this.generateErrorId();

    // Handle RuntimeValidationError
    if (error instanceof RuntimeValidationError) {
      return {
        type: ErrorType.VALIDATION,
        message: error.message,
        code: 'VALIDATION_ERROR',
        timestamp,
        requestId,
        recoverable: false,
        validationErrors: error.validationErrors
      };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        type: this.inferErrorType(error),
        message: error.message,
        code: error.name,
        timestamp,
        requestId,
        recoverable: this.isRecoverable(error)
      };
    }

    // Handle API error objects
    if (this.isApiErrorLike(error)) {
      return {
        type: error.type || ErrorType.UNKNOWN,
        message: error.message || 'Unknown error',
        code: error.code,
        status: error.status,
        details: error.details,
        timestamp: error.timestamp || timestamp,
        requestId: error.requestId || requestId,
        recoverable: error.recoverable ?? false,
        retryAfter: error.retryAfter,
        validationErrors: error.validationErrors
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        type: ErrorType.UNKNOWN,
        message: error,
        timestamp,
        requestId,
        recoverable: false
      };
    }

    // Handle unknown error types
    return {
      type: ErrorType.UNKNOWN,
      message: 'An unknown error occurred',
      details: error,
      timestamp,
      requestId,
      recoverable: false
    };
  }

  /**
   * Classifies errors for appropriate handling
   */
  private classifyError(error: TypeSafeApiError): ErrorClassification {
    const key = `${error.type}_${error.code || 'default'}`;
    const classification = this.errorClassifications.get(key) || this.errorClassifications.get(error.type);

    if (classification) {
      return classification;
    }

    // Default classification
    return {
      type: error.type,
      severity: 'medium',
      category: 'client',
      recoverable: error.recoverable,
      userFriendly: false
    };
  }

  /**
   * Logs errors based on severity and type
   */
  private logError(
    error: TypeSafeApiError,
    classification: ErrorClassification,
    context?: ErrorContext
  ): void {
    const logData = {
      error: {
        type: error.type,
        message: error.message,
        code: error.code,
        status: error.status,
        requestId: error.requestId,
        timestamp: error.timestamp
      },
      classification,
      context,
      validationErrors: error.validationErrors
    };

    switch (classification.severity) {
      case 'critical':
        console.error('CRITICAL ERROR:', logData);
        break;
      case 'high':
        console.error('HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        console.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case 'low':
        console.info('LOW SEVERITY ERROR:', logData);
        break;
    }
  }

  /**
   * Registers error handler for specific error type
   */
  registerErrorHandler(
    errorType: ErrorType,
    handler: (error: TypeSafeApiError, context?: ErrorContext) => void
  ): void {
    this.errorHandlers.set(errorType, handler);
  }

  /**
   * Registers global error handler
   */
  registerGlobalErrorHandler(
    handler: (error: TypeSafeApiError, context?: ErrorContext) => void
  ): void {
    this.globalErrorHandler = handler;
  }

  /**
   * Registers error classification
   */
  registerErrorClassification(
    key: string,
    classification: ErrorClassification
  ): void {
    this.errorClassifications.set(key, classification);
  }

  /**
   * Creates user-friendly error message
   */
  createUserFriendlyMessage(error: TypeSafeApiError): string {
    const classification = this.classifyError(error);

    if (!classification.userFriendly) {
      return this.getGenericUserMessage(error.type);
    }

    // Return specific user-friendly messages based on error type
    switch (error.type) {
      case ErrorType.NETWORK:
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      
      case ErrorType.AUTHENTICATION:
        return 'Your session has expired. Please log in again.';
      
      case ErrorType.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
      
      case ErrorType.VALIDATION:
        if (error.validationErrors && error.validationErrors.length > 0) {
          const fieldErrors = error.validationErrors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
          return `Please check your input: ${fieldErrors}`;
        }
        return 'Please check your input and try again.';
      
      case ErrorType.RATE_LIMIT:
        const retryAfter = error.retryAfter ? ` Please try again in ${error.retryAfter} seconds.` : '';
        return `You're making requests too quickly.${retryAfter}`;
      
      case ErrorType.SERVER:
        return 'A server error occurred. Our team has been notified and is working on a fix.';
      
      case ErrorType.TIMEOUT:
        return 'The request took too long to complete. Please try again.';
      
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Determines if error is recoverable
   */
  isErrorRecoverable(error: TypeSafeApiError): boolean {
    const classification = this.classifyError(error);
    return classification.recoverable;
  }

  /**
   * Gets suggested recovery actions
   */
  getRecoveryActions(error: TypeSafeApiError): string[] {
    const actions: string[] = [];

    switch (error.type) {
      case ErrorType.NETWORK:
        actions.push('Check your internet connection');
        actions.push('Try again in a few moments');
        break;
      
      case ErrorType.AUTHENTICATION:
        actions.push('Log in again');
        actions.push('Clear browser cache and cookies');
        break;
      
      case ErrorType.AUTHORIZATION:
        actions.push('Contact your administrator');
        actions.push('Check your account permissions');
        break;
      
      case ErrorType.VALIDATION:
        actions.push('Review and correct the highlighted fields');
        actions.push('Ensure all required information is provided');
        break;
      
      case ErrorType.RATE_LIMIT:
        actions.push('Wait before making another request');
        actions.push('Reduce the frequency of your requests');
        break;
      
      case ErrorType.TIMEOUT:
        actions.push('Try again with a smaller request');
        actions.push('Check your internet connection speed');
        break;
      
      default:
        actions.push('Try again');
        actions.push('Contact support if the problem persists');
    }

    return actions;
  }

  /**
   * Private helper methods
   */
  private initializeDefaultClassifications(): void {
    const classifications: Array<[string, ErrorClassification]> = [
      [ErrorType.NETWORK, {
        type: ErrorType.NETWORK,
        severity: 'medium',
        category: 'network',
        recoverable: true,
        userFriendly: true
      }],
      [ErrorType.AUTHENTICATION, {
        type: ErrorType.AUTHENTICATION,
        severity: 'medium',
        category: 'client',
        recoverable: true,
        userFriendly: true
      }],
      [ErrorType.AUTHORIZATION, {
        type: ErrorType.AUTHORIZATION,
        severity: 'medium',
        category: 'client',
        recoverable: false,
        userFriendly: true
      }],
      [ErrorType.VALIDATION, {
        type: ErrorType.VALIDATION,
        severity: 'low',
        category: 'validation',
        recoverable: false,
        userFriendly: true
      }],
      [ErrorType.SERVER, {
        type: ErrorType.SERVER,
        severity: 'high',
        category: 'server',
        recoverable: true,
        userFriendly: true
      }],
      [ErrorType.TIMEOUT, {
        type: ErrorType.TIMEOUT,
        severity: 'medium',
        category: 'network',
        recoverable: true,
        userFriendly: true
      }],
      [ErrorType.RATE_LIMIT, {
        type: ErrorType.RATE_LIMIT,
        severity: 'low',
        category: 'client',
        recoverable: true,
        userFriendly: true
      }],
      [ErrorType.UNKNOWN, {
        type: ErrorType.UNKNOWN,
        severity: 'medium',
        category: 'client',
        recoverable: false,
        userFriendly: false
      }]
    ];

    classifications.forEach(([key, classification]) => {
      this.errorClassifications.set(key, classification);
    });
  }

  private inferErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }
    
    if (message.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return ErrorType.AUTHENTICATION;
    }
    
    if (message.includes('forbidden') || message.includes('authorization')) {
      return ErrorType.AUTHORIZATION;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  private isRecoverable(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network and timeout errors are usually recoverable
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return true;
    }
    
    // Authentication errors are recoverable (user can log in again)
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return true;
    }
    
    // Server errors might be recoverable
    if (message.includes('server') || message.includes('internal')) {
      return true;
    }
    
    return false;
  }

  private isApiErrorLike(error: any): error is Partial<TypeSafeApiError> {
    return error && typeof error === 'object' && 
           (error.type || error.message || error.code || error.status);
  }

  private getGenericUserMessage(errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.NETWORK:
        return 'Connection problem. Please try again.';
      case ErrorType.AUTHENTICATION:
        return 'Please log in to continue.';
      case ErrorType.AUTHORIZATION:
        return 'Access denied.';
      case ErrorType.VALIDATION:
        return 'Please check your input.';
      case ErrorType.SERVER:
        return 'Server error. Please try again later.';
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default type-safe error handler instance
 */
export const typeSafeErrorHandler = new TypeSafeErrorHandler();

/**
 * Factory function for creating error handler instances
 */
export function createTypeSafeErrorHandler(): TypeSafeErrorHandler {
  return new TypeSafeErrorHandler();
}

/**
 * Convenience function for handling errors with type safety
 */
export function handleTypeSafeError(
  error: unknown,
  context?: ErrorContext
): TypeSafeApiError {
  return typeSafeErrorHandler.handleError(error, context);
}

/**
 * Type guard for TypeSafeApiError
 */
export function isTypeSafeApiError(error: unknown): error is TypeSafeApiError {
  return error !== null && 
         typeof error === 'object' && 
         'type' in error! && 
         'message' in error! && 
         'timestamp' in error!;
}

/**
 * Creates a typed error with validation
 */
export function createTypedError(
  type: ErrorType,
  message: string,
  options: Partial<Omit<TypeSafeApiError, 'type' | 'message' | 'timestamp'>> = {}
): TypeSafeApiError {
  return {
    type,
    message,
    timestamp: new Date(),
    recoverable: false,
    ...options
  };
}