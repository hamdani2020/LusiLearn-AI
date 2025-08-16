import express from 'express';
import request from 'supertest';
import { APIGateway, GatewayConfig } from '../api-gateway';
import { monitoringMiddleware } from '../../middleware/monitoring';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('API Gateway Integration', () => {
  let app: express.Application;
  let gateway: APIGateway;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(monitoringMiddleware);

    const config: GatewayConfig = {
      basePath: '/api',
      defaultVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
      enableRequestLogging: true,
      enableResponseLogging: true
    };

    gateway = new APIGateway(app, config);
  });

  describe('Core Gateway Functionality', () => {
    it('should setup health check endpoint', async () => {
      gateway.setupHealthCheck();

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.gateway).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should setup API documentation endpoints', async () => {
      gateway.setupAPIDocumentation();

      const apiResponse = await request(app)
        .get('/api')
        .expect(200);

      expect(apiResponse.body.name).toBe('LusiLearn API Gateway');
      expect(apiResponse.body.version).toBe('v1');
      expect(apiResponse.body.supportedVersions).toEqual(['v1', 'v2']);

      const routesResponse = await request(app)
        .get('/api/routes')
        .expect(200);

      expect(routesResponse.body.routes).toBeDefined();
      expect(routesResponse.body.total).toBeDefined();
    });

    it('should handle unsupported API versions', async () => {
      // Create a simple test router
      const testRouter = express.Router();
      testRouter.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });

      gateway.registerRoute({
        path: '/test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });

      const response = await request(app)
        .get('/api/v3/test')
        .expect(400);

      expect(response.body.error).toBe('Unsupported API Version');
      expect(response.body.supportedVersions).toEqual(['v1', 'v2']);
    });

    it('should apply versioning middleware correctly', async () => {
      const testRouter = express.Router();
      testRouter.get('/version-test', (req, res) => {
        res.json({ 
          message: 'version test',
          apiVersion: (req as any).apiVersion 
        });
      });

      gateway.registerRoute({
        path: '/version-test',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });

      const response = await request(app)
        .get('/api/v1/version-test')
        .expect(200);

      expect(response.body.message).toBe('version test');
      expect(response.body.apiVersion).toBe('v1');
    });

    it('should handle backward compatibility redirects', async () => {
      gateway.setupBackwardCompatibility();

      const response = await request(app)
        .get('/api/auth/login')
        .expect(301);

      expect(response.headers.location).toBe('/api/v1/auth/login');
    });
  });

  describe('Route Registration', () => {
    it('should register and access routes correctly', async () => {
      const testRouter = express.Router();
      testRouter.get('/hello', (req, res) => {
        res.json({ message: 'Hello World' });
      });

      gateway.registerRoute({
        path: '/hello',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });

      const response = await request(app)
        .get('/api/v1/hello')
        .expect(200);

      expect(response.body.message).toBe('Hello World');
    });

    it('should apply rate limiting when configured', async () => {
      const testRouter = express.Router();
      testRouter.get('/limited', (req, res) => {
        res.json({ message: 'limited endpoint' });
      });

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

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Cannot GET /api/v1/non-existent');
    });
  });

  describe('Monitoring Integration', () => {
    it('should work with monitoring middleware', async () => {
      const testRouter = express.Router();
      testRouter.get('/monitored', (req, res) => {
        res.json({ 
          message: 'monitored endpoint',
          requestId: (req as any).requestId 
        });
      });

      gateway.registerRoute({
        path: '/monitored',
        router: testRouter,
        version: 'v1',
        requiresAuth: false
      });

      const response = await request(app)
        .get('/api/v1/monitored')
        .expect(200);

      expect(response.body.message).toBe('monitored endpoint');
      expect(response.body.requestId).toBeDefined();
    });
  });
});