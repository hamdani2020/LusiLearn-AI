import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  errorHandler,
  ErrorTrackingService,
  ValidationError,
  AuthenticationError,
  DatabaseError,
  ExternalServiceError,
  asyncErrorHandler
} from '../error-handler';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;
  let setSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      url: '/test',
      path: '/test',
      query: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    setSpy = jest.fn();

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
      set: setSpy
    };

    mockNext = jest.fn();

    // Add request ID for tracking
    (mockRequest as any).requestId = 'test-request-id';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom Error Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Test validation error', { field: 'email' });
      
      expect(error.name).toBe('ValidationError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.severity).toBe('low');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      expect(error.name).toBe('AuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.severity).toBe('medium');
    });

    it('should create DatabaseError with correct properties', () => {
      const error = new DatabaseError('Connection failed');
      
      expect(error.name).toBe('DatabaseError');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.severity).toBe('critical');
    });
  });

  describe('Error Handler Function', () => {
    it('should handle ValidationError correctly', () => {
      const error = new ValidationError('Test validation error', { field: 'email' });
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ValidationError',
          message: 'Test validation error',
          code: 'VALIDATION_ERROR',
          requestId: 'test-request-id',
          severity: 'low'
        })
      );
      expect(setSpy).toHaveBeenCalledWith('X-Request-ID', 'test-request-id');
      expect(setSpy).toHaveBeenCalledWith('X-Error-Code', 'VALIDATION_ERROR');
    });

    it('should handle ZodError correctly', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number'
        }
      ]);
      
      errorHandler(zodError, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          message: 'Invalid input data',
          code: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Expected string, received number',
              code: 'invalid_type'
            })
          ])
        })
      );
    });

    it('should handle database duplicate key errors', () => {
      const error = new Error('duplicate key value violates unique constraint');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Conflict',
          message: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE'
        })
      );
    });

    it('should handle JWT errors', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication Error',
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        })
      );
    });

    it('should handle connection timeout errors', () => {
      const error = new Error('connection timeout');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Service Unavailable',
          message: 'Database connection timeout',
          code: 'DATABASE_TIMEOUT'
        })
      );
    });

    it('should handle external service errors', () => {
      const error = new Error('ECONNREFUSED');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(502);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Gateway',
          message: 'External service unavailable',
          code: 'EXTERNAL_SERVICE_UNAVAILABLE'
        })
      );
    });

    it('should handle generic errors with proper fallback', () => {
      const error = new Error('Generic error');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error',
          code: 'INTERNAL_ERROR'
        })
      );
    });
  });

  describe('ErrorTrackingService', () => {
    let errorTracker: ErrorTrackingService;

    beforeEach(() => {
      errorTracker = ErrorTrackingService.getInstance();
    });

    it('should track errors correctly', () => {
      const error = new ValidationError('Test error');
      const context = { userId: 'user123', path: '/test' };
      
      errorTracker.trackError(error, context);
      
      const stats = errorTracker.getErrorStats();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });

    it('should provide error statistics', () => {
      const stats = errorTracker.getErrorStats();
      
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('criticalErrorsLastHour');
      expect(stats).toHaveProperty('errorTypes');
      expect(stats).toHaveProperty('mostFrequentErrors');
      expect(stats).toHaveProperty('timeWindow');
    });

    it('should be a singleton', () => {
      const instance1 = ErrorTrackingService.getInstance();
      const instance2 = ErrorTrackingService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('asyncErrorHandler', () => {
    it('should catch async errors and pass to next', async () => {
      const asyncFunction = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrappedFunction = asyncErrorHandler(asyncFunction);
      
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle successful async functions', async () => {
      const asyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = asyncErrorHandler(asyncFunction);
      
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(asyncFunction).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error Context and Tracking', () => {
    it('should include comprehensive error context', () => {
      const error = new DatabaseError('Connection failed', { 
        host: 'localhost',
        port: 5432 
      });
      
      (mockRequest as any).user = { id: 'user123' };
      mockRequest.query = { search: 'test' };
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DatabaseError',
          code: 'DATABASE_ERROR',
          severity: 'critical',
          requestId: 'test-request-id'
        })
      );
    });

    it('should set proper response headers', () => {
      const error = new AuthenticationError('Invalid token');
      
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(setSpy).toHaveBeenCalledWith('X-Request-ID', 'test-request-id');
      expect(setSpy).toHaveBeenCalledWith('X-Error-Code', 'AUTHENTICATION_ERROR');
    });
  });
});