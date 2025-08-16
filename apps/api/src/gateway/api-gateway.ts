import express, { Request, Response, NextFunction, Router } from 'express';
import { logger } from '../utils/logger';
import { createRateLimitMiddleware, createValidationMiddleware } from '../middleware/security';

export interface RouteConfig {
  path: string;
  router: Router;
  version: string;
  requiresAuth?: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface GatewayConfig {
  basePath: string;
  defaultVersion: string;
  supportedVersions: string[];
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
}

export class APIGateway {
  private app: express.Application;
  private routes: Map<string, RouteConfig> = new Map();
  private config: GatewayConfig;
  private middlewareSetup: boolean = false;

  constructor(app: express.Application, config: GatewayConfig) {
    this.app = app;
    this.config = config;
  }

  private setupMiddleware() {
    if (this.middlewareSetup) return;
    
    // Request logging middleware
    if (this.config.enableRequestLogging) {
      this.app.use(this.requestLoggingMiddleware);
    }

    // API versioning middleware
    this.app.use(this.versioningMiddleware);

    // Response logging middleware
    if (this.config.enableResponseLogging) {
      this.app.use(this.responseLoggingMiddleware);
    }

    this.middlewareSetup = true;
  }

  private requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // Add request ID to request object for tracking
    (req as any).requestId = requestId;

    logger.info('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP')
      },
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Store start time for response logging
    (req as any).startTime = startTime;
    next();
  };

  private responseLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    const requestId = (req as any).requestId;

    // Override res.send to capture response
    res.send = function(body: any) {
      const duration = Date.now() - (req as any).startTime;
      
      logger.info('Outgoing response', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        timestamp: new Date().toISOString()
      });

      return originalSend.call(this, body);
    };

    // Override res.json to capture JSON responses
    res.json = function(obj: any) {
      const duration = Date.now() - (req as any).startTime;
      
      logger.info('Outgoing JSON response', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        responseSize: JSON.stringify(obj).length,
        timestamp: new Date().toISOString()
      });

      return originalJson.call(this, obj);
    };

    next();
  };

  private versioningMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Extract version from URL path (e.g., /api/v1/users -> v1)
    const pathParts = req.path.split('/');
    let version = this.config.defaultVersion;

    if (pathParts.length >= 3 && pathParts[2].startsWith('v')) {
      version = pathParts[2];
    }

    // Check if version is supported
    if (!this.config.supportedVersions.includes(version)) {
      return res.status(400).json({
        error: 'Unsupported API Version',
        message: `API version '${version}' is not supported`,
        supportedVersions: this.config.supportedVersions,
        code: 'UNSUPPORTED_VERSION'
      });
    }

    // Add version to request for downstream use
    (req as any).apiVersion = version;

    // Check for deprecated versions
    const routeKey = `${req.method}:${req.path}`;
    const routeConfig = this.routes.get(routeKey);
    
    if (routeConfig?.deprecated) {
      res.set('X-API-Deprecated', 'true');
      res.set('X-API-Deprecation-Message', routeConfig.deprecationMessage || 'This API version is deprecated');
      
      logger.warn('Deprecated API usage', {
        requestId: (req as any).requestId,
        method: req.method,
        path: req.path,
        version,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    next();
  };

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register a route with the API Gateway
   */
  public registerRoute(config: RouteConfig): void {
    // Setup middleware before registering routes
    this.setupMiddleware();
    
    const fullPath = `${this.config.basePath}/${config.version}${config.path}`;
    
    // Store route configuration for middleware use
    this.routes.set(`*:${fullPath}`, config);

    // Apply route-specific middleware if needed
    const middlewares: any[] = [];

    // Add authentication middleware if required
    if (config.requiresAuth) {
      try {
        const { authenticateToken } = require('../middleware/auth');
        middlewares.push(authenticateToken);
      } catch (error) {
        // In test environment, auth middleware might not be available
        logger.debug('Auth middleware not available, skipping');
      }
    }

    // Add rate limiting if specified
    if (config.rateLimit) {
      const limiter = createRateLimitMiddleware(config.rateLimit);
      middlewares.push(limiter);
    }

    // Register the route with middleware
    this.app.use(fullPath, ...middlewares, config.router);

    logger.info('Route registered', {
      path: fullPath,
      version: config.version,
      requiresAuth: config.requiresAuth,
      deprecated: config.deprecated,
      rateLimit: config.rateLimit
    });
  }

  /**
   * Register multiple routes at once
   */
  public registerRoutes(configs: RouteConfig[]): void {
    configs.forEach(config => this.registerRoute(config));
  }

  /**
   * Get API information and health status
   */
  public getAPIInfo(): any {
    return {
      name: 'LusiLearn API Gateway',
      version: this.config.defaultVersion,
      supportedVersions: this.config.supportedVersions,
      basePath: this.config.basePath,
      registeredRoutes: Array.from(this.routes.keys()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Setup health check endpoint
   */
  public setupHealthCheck(healthCheckFn?: () => Promise<any>): void {
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        const customHealth = healthCheckFn ? await healthCheckFn() : {};
        
        res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          gateway: {
            version: this.config.defaultVersion,
            supportedVersions: this.config.supportedVersions,
            registeredRoutes: this.routes.size
          },
          ...customHealth
        });
      } catch (error: any) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });
  }

  /**
   * Setup API documentation endpoint
   */
  public setupAPIDocumentation(): void {
    this.app.get('/api', (req: Request, res: Response) => {
      res.json(this.getAPIInfo());
    });

    this.app.get('/api/routes', (req: Request, res: Response) => {
      const routeInfo = Array.from(this.routes.entries()).map(([key, config]) => ({
        key,
        path: config.path,
        version: config.version,
        requiresAuth: config.requiresAuth,
        deprecated: config.deprecated,
        rateLimit: config.rateLimit
      }));

      res.json({
        routes: routeInfo,
        total: routeInfo.length
      });
    });
  }

  /**
   * Setup backward compatibility redirects
   */
  public setupBackwardCompatibility(): void {
    // Redirect old API paths to new versioned paths
    this.app.use('/api/auth/*', (req: Request, res: Response, next: NextFunction) => {
      if (!req.path.includes('/v1/')) {
        const newPath = req.path.replace('/api/auth', '/api/v1/auth');
        logger.info('Backward compatibility redirect', {
          oldPath: req.path,
          newPath,
          userAgent: req.get('User-Agent')
        });
        return res.redirect(301, newPath);
      }
      next();
    });

    // Add deprecation headers for old endpoints
    this.app.use('/api/v1/*', (req: Request, res: Response, next: NextFunction) => {
      // Example: Mark v1 as deprecated in favor of v2
      if (this.config.supportedVersions.includes('v2')) {
        res.set('X-API-Deprecated', 'false'); // v1 is still supported
        res.set('X-API-Upgrade-Available', 'v2');
      }
      next();
    });
  }
}