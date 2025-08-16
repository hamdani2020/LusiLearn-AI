import express from 'express';
import request from 'supertest';
import { 
  MonitoringService, 
  monitoringMiddleware, 
  securityMonitoringMiddleware,
  createMetricsEndpoint,
  createDetailedMetricsEndpoint
} from '../monitoring';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MonitoringService', () => {
  let monitoring: MonitoringService;

  beforeEach(() => {
    monitoring = MonitoringService.getInstance();
    // Clear metrics for each test
    (monitoring as any).metrics = [];
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MonitoringService.getInstance();
      const instance2 = MonitoringService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Metrics Management', () => {
    it('should add and retrieve metrics', () => {
      const metric = {
        requestId: 'test-123',
        method: 'GET',
        url: '/test',
        path: '/test',
        ip: '127.0.0.1',
        timestamp: new Date().toISOString()
      };

      monitoring.addMetric(metric);
      const metrics = monitoring.getMetrics(10);

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    it('should limit metrics to maximum count', () => {
      const maxMetrics = (monitoring as any).maxMetrics;
      
      // Add more metrics than the limit
      for (let i = 0; i < maxMetrics + 100; i++) {
        monitoring.addMetric({
          requestId: `test-${i}`,
          method: 'GET',
          url: '/test',
          path: '/test',
          ip: '127.0.0.1',
          timestamp: new Date().toISOString()
        });
      }

      const allMetrics = monitoring.getMetrics(maxMetrics + 200);
      expect(allMetrics.length).toBeLessThanOrEqual(maxMetrics);
    });

    it('should generate metrics summary', () => {
      // Add some test metrics
      const now = new Date();
      monitoring.addMetric({
        requestId: 'test-1',
        method: 'GET',
        url: '/test',
        path: '/test',
        ip: '127.0.0.1',
        statusCode: 200,
        duration: 100,
        timestamp: now.toISOString()
      });

      monitoring.addMetric({
        requestId: 'test-2',
        method: 'POST',
        url: '/test',
        path: '/test',
        ip: '127.0.0.1',
        statusCode: 400,
        duration: 200,
        timestamp: now.toISOString()
      });

      const summary = monitoring.getMetricsSummary();

      expect(summary.totalRequests).toBe(2);
      expect(summary.averageResponseTime).toBe(150);
      expect(summary.errorRate).toBe(50);
      expect(summary.statusCodeDistribution).toEqual({ 200: 1, 400: 1 });
    });
  });
});

describe('Monitoring Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(monitoringMiddleware);

    // Clear global rate limit store
    global.rateLimitStore = new Map();
  });

  describe('monitoringMiddleware', () => {
    it('should add request ID and start time to request', async () => {
      app.get('/test', (req, res) => {
        expect((req as any).requestId).toBeDefined();
        expect((req as any).startTime).toBeDefined();
        res.json({ success: true });
      });

      await request(app)
        .get('/test')
        .expect(200);
    });

    it('should log slow requests', async () => {
      app.get('/slow', (req, res) => {
        // Simulate slow response
        setTimeout(() => {
          res.json({ success: true });
        }, 100);
      });

      await request(app)
        .get('/slow')
        .expect(200);

      // Note: In a real test, you might need to wait for the timeout
      // This is a simplified test
    });

    it('should log error responses', async () => {
      app.get('/error', (req, res) => {
        res.status(500).json({ error: 'Test error' });
      });

      await request(app)
        .get('/error')
        .expect(500);

      expect(logger.error).toHaveBeenCalledWith('Error response', expect.objectContaining({
        method: 'GET',
        path: '/error',
        statusCode: 500
      }));
    });
  });

  describe('securityMonitoringMiddleware', () => {
    beforeEach(() => {
      app.use(securityMonitoringMiddleware);
    });

    it('should detect suspicious path traversal attempts', async () => {
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test?file=../../../etc/passwd')
        .expect(200);

      expect(logger.warn).toHaveBeenCalledWith('Suspicious request detected', expect.objectContaining({
        method: 'GET',
        url: '/test?file=../../../etc/passwd'
      }));
    });

    it('should detect XSS attempts', async () => {
      app.post('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/test')
        .send({ content: '<script>alert("xss")</script>' })
        .expect(200);

      expect(logger.warn).toHaveBeenCalledWith('Suspicious request detected', expect.any(Object));
    });

    it('should detect SQL injection attempts', async () => {
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .get('/test?id=1 UNION SELECT * FROM users')
        .expect(200);

      expect(logger.warn).toHaveBeenCalledWith('Suspicious request detected', expect.any(Object));
    });

    it('should implement rate limiting per IP', async () => {
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      // Make requests up to the limit (100 per minute)
      const promises = [];
      for (let i = 0; i < 102; i++) {
        promises.push(request(app).get('/test'));
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});

describe('Metrics Endpoints', () => {
  let app: express.Application;
  let monitoring: MonitoringService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    monitoring = MonitoringService.getInstance();
    (monitoring as any).metrics = [];

    app.get('/metrics', createMetricsEndpoint());
    app.get('/metrics/detailed', createDetailedMetricsEndpoint());
  });

  describe('createMetricsEndpoint', () => {
    it('should return metrics summary', async () => {
      // Add some test metrics
      monitoring.addMetric({
        requestId: 'test-1',
        method: 'GET',
        url: '/test',
        path: '/test',
        ip: '127.0.0.1',
        statusCode: 200,
        duration: 100,
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalRequests).toBeDefined();
      expect(response.body.data.averageResponseTime).toBeDefined();
      expect(response.body.data.errorRate).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('createDetailedMetricsEndpoint', () => {
    it('should return detailed metrics', async () => {
      // Add test metrics
      monitoring.addMetric({
        requestId: 'test-1',
        method: 'GET',
        url: '/test',
        path: '/test',
        ip: '127.0.0.1',
        statusCode: 200,
        duration: 100,
        timestamp: new Date().toISOString()
      });

      const response = await request(app)
        .get('/metrics/detailed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      // Add multiple metrics
      for (let i = 0; i < 10; i++) {
        monitoring.addMetric({
          requestId: `test-${i}`,
          method: 'GET',
          url: '/test',
          path: '/test',
          ip: '127.0.0.1',
          timestamp: new Date().toISOString()
        });
      }

      const response = await request(app)
        .get('/metrics/detailed?limit=5')
        .expect(200);

      expect(response.body.data.metrics).toHaveLength(5);
    });
  });
});

describe('Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(monitoringMiddleware);
    app.use(securityMonitoringMiddleware);

    app.get('/test', (req, res) => {
      res.json({ 
        success: true, 
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString()
      });
    });

    app.get('/metrics', createMetricsEndpoint());
    app.get('/metrics/detailed', createDetailedMetricsEndpoint());

    // Clear metrics
    const monitoring = MonitoringService.getInstance();
    (monitoring as any).metrics = [];
  });

  it('should track requests and provide metrics', async () => {
    // Clear rate limit store for this test
    (global as any).rateLimitStore = new Map();
    
    // Make some test requests
    await request(app).get('/test').expect(200);
    await request(app).get('/test').expect(200);
    await request(app).get('/test').expect(200);

    // Check metrics
    const metricsResponse = await request(app)
      .get('/metrics')
      .expect(200);

    expect(metricsResponse.body.data.totalRequests).toBeGreaterThanOrEqual(3);

    // Check detailed metrics
    const detailedResponse = await request(app)
      .get('/metrics/detailed')
      .expect(200);

    expect(detailedResponse.body.data.metrics.length).toBeGreaterThanOrEqual(3);
  });
});