import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

export class ValidationError extends Error implements AppError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  constructor(message: string, public details?: any, public context?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error implements AppError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  constructor(message: string = 'Authentication failed', public context?: Record<string, any>) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements AppError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  constructor(message: string = 'Insufficient permissions', public context?: Record<string, any>) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  code = 'NOT_FOUND';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  constructor(message: string = 'Resource not found', public context?: Record<string, any>) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  code = 'CONFLICT';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  constructor(message: string = 'Resource conflict', public context?: Record<string, any>) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements AppError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  
  constructor(message: string = 'Rate limit exceeded', public context?: Record<string, any>) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends Error implements AppError {
  statusCode = 503;
  code = 'SERVICE_UNAVAILABLE';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
  
  constructor(message: string = 'Service temporarily unavailable', public context?: Record<string, any>) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export class ExternalServiceError extends Error implements AppError {
  statusCode = 502;
  code = 'EXTERNAL_SERVICE_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
  
  constructor(message: string = 'External service error', public context?: Record<string, any>) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends Error implements AppError {
  statusCode = 500;
  code = 'DATABASE_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'critical';
  
  constructor(message: string = 'Database operation failed', public context?: Record<string, any>) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class AIServiceError extends Error implements AppError {
  statusCode = 502;
  code = 'AI_SERVICE_ERROR';
  isOperational = true;
  severity: 'low' | 'medium' | 'high' | 'critical' = 'high';
  
  constructor(message: string = 'AI service error', public context?: Record<string, any>) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Error tracking and alerting service
export class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private errorCounts: Map<string, { count: number; lastOccurred: Date }> = new Map();
  private criticalErrors: AppError[] = [];
  private readonly maxCriticalErrors = 100;

  private constructor() {}

  public static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  public trackError(error: AppError, context: Record<string, any>): void {
    const errorKey = `${error.name}:${error.code}`;
    const existing = this.errorCounts.get(errorKey);
    
    this.errorCounts.set(errorKey, {
      count: (existing?.count || 0) + 1,
      lastOccurred: new Date()
    });

    // Track critical errors separately
    if (error.severity === 'critical' || error.severity === 'high') {
      this.criticalErrors.push({
        ...error,
        context,
        timestamp: new Date()
      } as AppError & { timestamp: Date });

      // Keep only recent critical errors
      if (this.criticalErrors.length > this.maxCriticalErrors) {
        this.criticalErrors = this.criticalErrors.slice(-this.maxCriticalErrors);
      }

      // Send alert for critical errors
      this.sendAlert(error, context);
    }
  }

  public getErrorStats(): any {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = Array.from(this.errorCounts.entries())
      .filter(([_, data]) => data.lastOccurred > oneHourAgo);

    const totalErrors = recentErrors.reduce((sum, [_, data]) => sum + data.count, 0);
    const criticalErrorsLastHour = this.criticalErrors.filter(
      error => (error as any).timestamp > oneHourAgo
    ).length;

    return {
      totalErrors,
      criticalErrorsLastHour,
      errorTypes: recentErrors.length,
      mostFrequentErrors: recentErrors
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([type, data]) => ({ type, ...data })),
      timeWindow: '1 hour'
    };
  }

  private sendAlert(error: AppError, context: Record<string, any>): void {
    // In production, this would integrate with alerting services like PagerDuty, Slack, etc.
    logger.error('CRITICAL ERROR ALERT', {
      error: error.message,
      code: error.code,
      severity: error.severity,
      context,
      timestamp: new Date().toISOString(),
      alertLevel: 'CRITICAL'
    });

    // Example: Send to external monitoring service
    if (process.env.WEBHOOK_URL) {
      // This would be implemented to send to external services
      logger.info('Alert would be sent to external monitoring service');
    }
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId || 'unknown';
  const userId = (req as any).user?.id;
  const errorTracker = ErrorTrackingService.getInstance();

  // Enhanced error context
  const errorContext = {
    requestId,
    userId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    ...(error.context || {})
  };

  // Track error for monitoring and alerting
  errorTracker.trackError(error, errorContext);

  // Enhanced error logging based on severity
  const logLevel = error.severity === 'critical' ? 'error' : 
                  error.severity === 'high' ? 'error' :
                  error.severity === 'medium' ? 'warn' : 'info';

  logger[logLevel]('Error occurred', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    severity: error.severity,
    isOperational: error.isOperational,
    ...errorContext
  });

  // Set error tracking headers
  res.set('X-Request-ID', requestId);
  res.set('X-Error-Code', error.code || 'UNKNOWN_ERROR');

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid input data',
      code: 'VALIDATION_ERROR',
      requestId,
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      })),
      timestamp: new Date().toISOString()
    });
  }

  // Handle known application errors
  if (error.statusCode && error.isOperational) {
    return res.status(error.statusCode).json({
      error: error.name || 'Application Error',
      message: error.message,
      code: error.code,
      requestId,
      severity: error.severity,
      timestamp: new Date().toISOString(),
      ...(error.details && { details: error.details })
    });
  }

  // Handle database errors with enhanced detection
  if (error.message.includes('duplicate key value') || error.message.includes('unique constraint')) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid reference to related resource',
      code: 'INVALID_REFERENCE',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('connection') && error.message.includes('timeout')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection timeout',
      code: 'DATABASE_TIMEOUT',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired',
      code: 'TOKEN_EXPIRED',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle network and external service errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    return res.status(502).json({
      error: 'Bad Gateway',
      message: 'External service unavailable',
      code: 'EXTERNAL_SERVICE_UNAVAILABLE',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Request timeout',
      code: 'REQUEST_TIMEOUT',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Handle memory and resource errors
  if (error.message.includes('out of memory') || error.message.includes('ENOMEM')) {
    // This is critical - log and alert
    logger.error('CRITICAL: Out of memory error', errorContext);
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server temporarily overloaded',
      code: 'RESOURCE_EXHAUSTED',
      requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Default server error with enhanced information
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = error.statusCode || 500;
  
  // Log unhandled errors as critical
  if (!error.isOperational) {
    logger.error('UNHANDLED ERROR - This should be investigated', {
      ...errorContext,
      stack: error.stack,
      severity: 'critical'
    });
  }

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: isProduction ? 'Something went wrong' : error.message,
    code: error.code || 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: error.stack })
  });
};

// Async error handler wrapper
export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global unhandled error handlers
export const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION - Application will exit', {
      error: error.message,
      stack: error.stack,
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    
    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('UNHANDLED PROMISE REJECTION', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
    
    // Don't exit on unhandled rejections in production, but log them
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
};