import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';
import { ValidationError } from './error-handler';

export interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };
  helmet: {
    contentSecurityPolicy?: boolean | object;
    crossOriginEmbedderPolicy?: boolean;
    crossOriginOpenerPolicy?: boolean | object;
    crossOriginResourcePolicy?: boolean | object;
    dnsPrefetchControl?: boolean | object;
    frameguard?: boolean | object;
    hidePoweredBy?: boolean;
    hsts?: boolean | object;
    ieNoOpen?: boolean;
    noSniff?: boolean;
    originAgentCluster?: boolean;
    permittedCrossDomainPolicies?: boolean;
    referrerPolicy?: boolean | object;
    xssFilter?: boolean;
  };
  validation: {
    enableRequestValidation: boolean;
    enableResponseValidation: boolean;
    stripUnknownFields: boolean;
  };
  https: {
    enforceHttps: boolean;
    trustProxy: boolean;
  };
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API
    crossOriginOpenerPolicy: false, // Disable for API compatibility
    crossOriginResourcePolicy: false, // Disable for API compatibility
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
  },
  validation: {
    enableRequestValidation: true,
    enableResponseValidation: false, // Disable in production for performance
    stripUnknownFields: true,
  },
  https: {
    enforceHttps: process.env.NODE_ENV === 'production',
    trustProxy: true,
  },
};

/**
 * Enhanced rate limiting middleware with different limits for different endpoints
 */
export const createRateLimitMiddleware = (config?: Partial<SecurityConfig['rateLimit']>) => {
  const rateLimitConfig = { ...defaultSecurityConfig.rateLimit, ...config };

  return rateLimit({
    windowMs: rateLimitConfig.windowMs,
    max: rateLimitConfig.max,
    skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
    skipFailedRequests: rateLimitConfig.skipFailedRequests,
    message: {
      error: 'Rate Limit Exceeded',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
        code: 'RATE_LIMIT_EXCEEDED'
      });
    },
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      return (req as any).user?.id || req.ip || 'unknown';
    },
  });
};

/**
 * Specialized rate limiters for different endpoint types
 */
export const authRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // 100 in dev, 20 in production
});

export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Standard API rate limit
});

export const uploadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limited uploads per hour
});

/**
 * CORS middleware with security-focused configuration
 */
export const createCorsMiddleware = (config?: Partial<SecurityConfig['cors']>) => {
  const corsConfig = { ...defaultSecurityConfig.cors, ...config };

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (typeof corsConfig.origin === 'boolean') {
        return callback(null, corsConfig.origin);
      }

      if (typeof corsConfig.origin === 'string') {
        return callback(null, origin === corsConfig.origin);
      }

      if (Array.isArray(corsConfig.origin)) {
        return callback(null, corsConfig.origin.includes(origin));
      }

      // Default: allow all origins in development, restrict in production
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Not allowed by CORS'), false);
      }

      return callback(null, true);
    },
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });
};

/**
 * Helmet middleware with comprehensive security headers
 */
export const createHelmetMiddleware = (config?: Partial<SecurityConfig['helmet']>) => {
  const helmetConfig = { ...defaultSecurityConfig.helmet, ...config };

  return helmet(helmetConfig);
};

/**
 * HTTPS enforcement middleware
 */
export const httpsEnforcementMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!defaultSecurityConfig.https.enforceHttps) {
    return next();
  }

  // Trust proxy headers if configured
  if (defaultSecurityConfig.https.trustProxy) {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
  } else {
    if (!req.secure) {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
  }

  next();
};

/**
 * Request validation middleware using Zod schemas
 */
export const createValidationMiddleware = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body && req.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query && req.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params && req.params) {
        req.params = schema.params.parse(req.params);
      }

      // Validate headers
      if (schema.headers && req.headers) {
        const validatedHeaders = schema.headers.parse(req.headers);
        // Don't replace headers, just validate them
        Object.assign(req.headers, validatedHeaders);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors,
          ip: req.ip
        });

        return next(new ValidationError('Invalid request data', {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        }));
      }

      next(error);
    }
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination parameters
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
  }),

  // ID parameter
  id: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Common headers
  apiHeaders: z.object({
    'x-api-version': z.string().optional(),
    'user-agent': z.string().optional(),
    'authorization': z.string().optional(),
  }).passthrough(), // Allow other headers

  // Search parameters
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    category: z.string().optional(),
    tags: z.string().optional(),
  }),
};

/**
 * Security headers middleware for additional protection
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add custom security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });

  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * Input sanitization middleware
 */
export const inputSanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
        // Extract content between script tags and return just the content
        const content = match.replace(/<\/?script[^>]*>/gi, '');
        return content;
      })
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers with quotes
      .replace(/on\w+\s*=\s*[^"'\s>]+/gi, '') // Remove event handlers without quotes
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Comprehensive security middleware setup
 */
export const setupSecurityMiddleware = (app: any, config?: Partial<SecurityConfig>) => {
  const securityConfig = { ...defaultSecurityConfig, ...config };

  // Trust proxy if configured
  if (securityConfig.https.trustProxy) {
    app.set('trust proxy', 1);
  }

  // HTTPS enforcement (should be first)
  app.use(httpsEnforcementMiddleware);

  // Security headers
  app.use(createHelmetMiddleware(securityConfig.helmet));
  app.use(securityHeadersMiddleware);

  // CORS
  app.use(createCorsMiddleware(securityConfig.cors));

  // Input sanitization
  app.use(inputSanitizationMiddleware);

  // Global rate limiting
  app.use(createRateLimitMiddleware(securityConfig.rateLimit));

  logger.info('Security middleware configured', {
    httpsEnforced: securityConfig.https.enforceHttps,
    corsOrigin: securityConfig.cors.origin,
    rateLimitMax: securityConfig.rateLimit.max,
    rateLimitWindow: `${securityConfig.rateLimit.windowMs / 1000}s`
  });
};

/**
 * Create endpoint-specific security middleware
 */
export const createEndpointSecurity = (options: {
  rateLimit?: Partial<SecurityConfig['rateLimit']>;
  validation?: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  };
  requireAuth?: boolean;
}) => {
  const middlewares: any[] = [];

  // Add rate limiting if specified
  if (options.rateLimit) {
    middlewares.push(createRateLimitMiddleware(options.rateLimit));
  }

  // Add validation if specified
  if (options.validation) {
    middlewares.push(createValidationMiddleware(options.validation));
  }

  // Add authentication if required
  if (options.requireAuth) {
    try {
      const { authenticateToken } = require('./auth');
      middlewares.push(authenticateToken);
    } catch (error) {
      logger.warn('Auth middleware not available for endpoint security');
    }
  }

  return middlewares;
};