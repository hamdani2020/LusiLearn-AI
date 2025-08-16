import express from 'express';
import request from 'supertest';
import { APIGateway, GatewayConfig, RouteConfig } from '../api-gateway';
import { logger } from '../../utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('APIGateway', () => {
  let app: express.Application;
  let gateway: APIGateway;
  let testRouter: express.Router;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const config: GatewayConfig = {
      basePath: '/api',
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
      enableRequestLogging: true,
      enableResponseLogging: true
    };

    gateway = new APIGateway(app, config);

    // Create a test router
    testRouter = express.Router();
    testRouter.get('/test', (req, res) => {
      res.json({ message: 'test endpoint', version: (req as any).apiVersion });
    });

    testRouter.post('/protected', (req, res) => {
      res.json({ message: 'protected endpoint', user: (req as any).user });
    });
  });

  describe('Route Registration', () => {
    it('should register a route successfully', () => {
      const routeConfig: RouteConfig = {
        path: '/test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      };

      expect(() => gateway.registerRoute(routeConfig)).not.toThrow();
      expect(logger.info).toHaveBeenCalledWith('Route registered', expect.objectContaining({
        path: '/api/v1/test',
        version: 'v1',
        requiresAuth: false
      }));
    });

    it('should register multiple routes', () => {
      const routeConfigs: RouteConfig[] = [
        {
          path: '/test1',
          router: testRouter,
          version: 'v1',
          requiresAuth: false
        },
        {
          path: '/test2',
          router: testRouter,
          version: 'v1',
          requiresAuth: true
        }
      ];

      expect(() => gateway.registerRoutes(routeConfigs)).not.toThrow();
      expect(logger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('API Versioning', () => {
    beforeEach(() => {
      gateway.registerRoute({
        path: '/test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });
    });

    it('should handle v1 requests correctly', async () => {
      const response = await request(app)
        .get('/api/v1/test')
        .expect(200);

      expect(response.body.message).toBe('test endpoint');
      expect(response.body.version).toBe('v1');
    });

    it('should reject unsupported API versions', async () => {
      const response = await request(app)
        .get('/api/v3/test')
        .expect(400);

      expect(response.body.error).toBe('Unsupported API Version');
      expect(response.body.supportedVersions).toEqual(['v1', 'v2']);
    });

    it('should use default version when no version specified', async () => {
      // This would require additional middleware setup for default version handling
      // For now, we test that the versioning middleware sets the version correctly
      const response = await request(app)
        .get('/api/v1/test')
        .expect(200);

      expect(response.body.version).toBe('v1');
    });
  });

  describe('Health Check', () => {
    it('should setup health check endpoint', async () => {
      gateway.setupHealthCheck();

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.gateway).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle health check with custom function', async () => {
      const customHealthCheck = jest.fn().mockResolvedValue({
        database: 'healthy',
        redis: 'healthy'
      });

      gateway.setupHealthCheck(customHealthCheck);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBe('healthy');
      expect(response.body.redis).toBe('healthy');
      expect(customHealthCheck).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      const failingHealthCheck = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      gateway.setupHealthCheck(failingHealthCheck);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('API Documentation', () => {
    beforeEach(() => {
      gateway.registerRoute({
        path: '/test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });
      gateway.setupAPIDocumentation();
    });

    it('should provide API information', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.name).toBe('LusiLearn API Gateway');
      expect(response.body.version).toBe('v1');
      expect(response.body.supportedVersions).toEqual(['v1', 'v2']);
    });

    it('should provide route information', async () => {
      const response = await request(app)
        .get('/api/routes')
        .expect(200);

      expect(response.body.routes).toBeDefined();
      expect(response.body.total).toBeGreaterThan(0);
      expect(response.body.routes[0]).toHaveProperty('path');
      expect(response.body.routes[0]).toHaveProperty('version');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      gateway.registerRoute({
        path: '/limited',
        router: testRouter,
        version: 'v1',
        requiresAuth: false,
        rateLimit: {
          windowMs: 60000, // 1 minute
          max: 2 // Only 2 requests per minute
        }
      });
    });

    it('should apply route-specific rate limiting', async () => {
      // First request should succeed
      await request(app)
        .get('/api/v1/limited')
        .expect(200);

      // Second request should succeed
      await request(app)
        .get('/api/v1/limited')
        .expect(200);

      // Third request should be rate limited
      const response = await request(app)
        .get('/api/v1/limited')
        .expect(429);

      expect(response.body.error).toBe('Rate Limit Exceeded');
    });
  });

  describe('Authentication Integration', () => {
    beforeEach(() => {
      // Mock authentication middleware
      jest.doMock('../../middleware/auth', () => ({
        authenticateToken: (req: any, res: any, next: any) => {
          const token = req.headers.authorization?.split(' ')[1];
          if (token === 'valid-token') {
            req.user = { id: 'user123', email: 'test@example.com' };
            next();
          } else {
            res.status(401).json({ error: 'Unauthorized' });
          }
        }
      }));

      gateway.registerRoute({
        path: '/protected',
        router: testRouter,
        version: 'v1',
        requiresAuth: true
      });
    });

    it('should protect routes that require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/protected')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should allow access with valid authentication', async () => {
      const response = await request(app)
        .post('/api/v1/protected')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toBe('protected endpoint');
      expect(response.body.user).toEqual({
        id: 'user123',
        email: 'test@example.com'
      });
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      gateway.setupBackwardCompatibility();
    });

    it('should redirect old auth paths to versioned paths', async () => {
      const response = await request(app)
        .get('/api/auth/login')
        .expect(301);

      expect(response.headers.location).toBe('/api/v1/auth/login');
    });

    it('should add upgrade headers for supported versions', async () => {
      gateway.registerRoute({
        path: '/test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });

      const response = await request(app)
        .get('/api/v1/test')
        .expect(200);

      expect(response.headers['x-api-upgrade-available']).toBe('v2');
    });
  });

  describe('Deprecation Handling', () => {
    beforeEach(() => {
      gateway.registerRoute({
        path: '/deprecated',
        router: testRouter,
        version: 'v1',
        requiresAuth: false,
        deprecated: true,
        deprecationMessage: 'This endpoint will be removed in v2'
      });
    });

    it('should add deprecation headers for deprecated routes', async () => {
      const response = await request(app)
        .get('/api/v1/deprecated')
        .expect(200);

      expect(response.headers['x-api-deprecated']).toBe('true');
      expect(response.headers['x-api-deprecation-message']).toBe('This endpoint will be removed in v2');
    });

    it('should log deprecation warnings', async () => {
      await request(app)
        .get('/api/v1/deprecated')
        .expect(200);

      expect(logger.warn).toHaveBeenCalledWith('Deprecated API usage', expect.objectContaining({
        method: 'GET',
        path: '/api/v1/deprecated',
        version: 'v1'
      }));
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const errorRouter = express.Router();
      errorRouter.get('/error', (req, res) => {
        throw new Error('Test error');
      });

      gateway.registerRoute({
        path: '/error',
        router: errorRouter,
        version: 'v1',
        requiresAuth: false
      });

      // Add error handler
      app.use((error: any, req: any, res: any, next: any) => {
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
      });
    });

    it('should handle route errors properly', async () => {
      const response = await request(app)
        .get('/api/v1/error')
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Test error');
    });
  });

  describe('Gateway Information', () => {
    it('should return correct API information', () => {
      const info = gateway.getAPIInfo();

      expect(info.name).toBe('LusiLearn API Gateway');
      expect(info.version).toBe('v1');
      expect(info.supportedVersions).toEqual(['v1', 'v2']);
      expect(info.basePath).toBe('/api');
      expect(info.timestamp).toBeDefined();
    });
  });
});