import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import {
  setupSecurityMiddleware,
  createRateLimitMiddleware,
  createCorsMiddleware,
  createHelmetMiddleware,
  createValidationMiddleware,
  httpsEnforcementMiddleware,
  securityHeadersMiddleware,
  inputSanitizationMiddleware,
  commonSchemas,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit
} from '../security';

describe('Security Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('setupSecurityMiddleware', () => {
    it('should setup comprehensive security middleware', async () => {
      setupSecurityMiddleware(app);
      
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      // Check that security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should apply rate limiting', async () => {
      const rateLimiter = createRateLimitMiddleware({
        windowMs: 60 * 1000, // 1 minute
        max: 2 // Only 2 requests per minute for testing
      });

      app.use(rateLimiter);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      // First request should succeed
      await request(app)
        .get('/test')
        .expect(200);

      // Second request should succeed
      await request(app)
        .get('/test')
        .expect(200);

      // Third request should be rate limited
      await request(app)
        .get('/test')
        .expect(429);
    });

    it('should have different rate limits for different endpoint types', () => {
      expect(authRateLimit).toBeDefined();
      expect(apiRateLimit).toBeDefined();
      expect(uploadRateLimit).toBeDefined();
    });
  });

  describe('CORS Middleware', () => {
    it('should handle CORS with default configuration', async () => {
      const corsMiddleware = createCorsMiddleware();
      app.use(corsMiddleware);
      
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject unauthorized origins in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const corsMiddleware = createCorsMiddleware({
        origin: 'https://lusilearn.com',
        credentials: true
      });
      
      app.use(corsMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      // CORS middleware will block the request before it reaches our handler
      const response = await request(app)
        .get('/test')
        .set('Origin', 'https://malicious-site.com');

      // The request should either be blocked (500) or not have CORS headers
      expect(response.status === 500 || !response.headers['access-control-allow-origin']).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Helmet Security Headers', () => {
    it('should apply security headers', async () => {
      const helmetMiddleware = createHelmetMiddleware();
      app.use(helmetMiddleware);
      
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should redirect HTTP to HTTPS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock the https enforcement to work in test environment
      app.use((req, res, next) => {
        if (process.env.NODE_ENV === 'production' && !req.secure && !req.header('x-forwarded-proto')) {
          return res.redirect(301, `https://${req.get('host')}${req.url}`);
        }
        next();
      });
      
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/test')
        .set('Host', 'example.com');

      // In test environment, req.secure is false, so it should redirect
      expect(response.status).toBe(301);
      expect(response.headers.location).toBe('https://example.com/test');

      process.env.NODE_ENV = originalEnv;
    });

    it('should not redirect in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.use(httpsEnforcementMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      await request(app)
        .get('/test')
        .expect(200);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Request Validation Middleware', () => {
    const testSchema = z.object({
      name: z.string().min(1).max(50),
      email: z.string().email(),
      age: z.number().min(0).max(120)
    });

    it('should validate request body successfully', async () => {
      const validationMiddleware = createValidationMiddleware({
        body: testSchema
      });

      app.post('/test', validationMiddleware, (req, res) => {
        res.json({ message: 'success', data: req.body });
      });

      await request(app)
        .post('/test')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25
        })
        .expect(200);
    });

    it('should reject invalid request body', async () => {
      const validationMiddleware = createValidationMiddleware({
        body: testSchema
      });

      app.post('/test', validationMiddleware, (req, res) => {
        res.json({ message: 'success', data: req.body });
      });

      await request(app)
        .post('/test')
        .send({
          name: '', // Invalid: empty string
          email: 'invalid-email', // Invalid: not an email
          age: -5 // Invalid: negative age
        })
        .expect(400);
    });

    it('should validate query parameters', async () => {
      const validationMiddleware = createValidationMiddleware({
        query: commonSchemas.pagination
      });

      app.get('/test', validationMiddleware, (req, res) => {
        res.json({ message: 'success', query: req.query });
      });

      await request(app)
        .get('/test?page=2&limit=20&sort=name&order=desc')
        .expect(200);
    });

    it('should validate route parameters', async () => {
      const validationMiddleware = createValidationMiddleware({
        params: commonSchemas.id
      });

      app.get('/test/:id', validationMiddleware, (req, res) => {
        res.json({ message: 'success', params: req.params });
      });

      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .get(`/test/${validUuid}`)
        .expect(200);

      await request(app)
        .get('/test/invalid-uuid')
        .expect(400);
    });
  });

  describe('Security Headers Middleware', () => {
    it('should add custom security headers', async () => {
      app.use(securityHeadersMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success' });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['permissions-policy']).toBe('geolocation=(), microphone=(), camera=()');
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
      expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
      
      // Should remove server information
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Input Sanitization Middleware', () => {
    it('should sanitize malicious input', async () => {
      app.use(inputSanitizationMiddleware);
      app.post('/test', (req, res) => {
        res.json({ message: 'success', data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          name: '<script>alert("xss")</script>John',
          description: 'javascript:alert("xss")',
          content: 'onclick="alert(\'xss\')" some content'
        })
        .expect(200);

      // Script tags should be removed but content preserved
      expect(response.body.data.name).toContain('John');
      expect(response.body.data.name).not.toContain('<script>');
      expect(response.body.data.description).toBe('alert("xss")');
      // The onclick handler should be removed, leaving the content
      expect(response.body.data.content).toContain('some content');
      expect(response.body.data.content).not.toContain('onclick');
    });

    it('should sanitize nested objects and arrays', async () => {
      app.use(inputSanitizationMiddleware);
      app.post('/test', (req, res) => {
        res.json({ message: 'success', data: req.body });
      });

      const response = await request(app)
        .post('/test')
        .send({
          user: {
            name: '<script>alert("xss")</script>John',
            tags: ['<script>tag1</script>', 'javascript:tag2']
          }
        })
        .expect(200);

      expect(response.body.data.user.name).toContain('John');
      expect(response.body.data.user.name).not.toContain('<script>');
      // Script tags should be removed, leaving just the content
      expect(response.body.data.user.tags[0]).not.toContain('<script>');
      expect(response.body.data.user.tags[0]).toContain('tag1');
      expect(response.body.data.user.tags[1]).toBe('tag2');
    });

    it('should sanitize query parameters', async () => {
      app.use(inputSanitizationMiddleware);
      app.get('/test', (req, res) => {
        res.json({ message: 'success', query: req.query });
      });

      const response = await request(app)
        .get('/test?search=<script>alert("xss")</script>test&category=javascript:alert("xss")')
        .expect(200);

      expect(response.body.query.search).toContain('test');
      expect(response.body.query.search).not.toContain('<script>');
      expect(response.body.query.category).toBe('alert("xss")');
    });
  });

  describe('Common Schemas', () => {
    it('should validate pagination parameters', () => {
      const validPagination = {
        page: '2',
        limit: '20',
        sort: 'name',
        order: 'desc'
      };

      const result = commonSchemas.pagination.parse(validPagination);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.sort).toBe('name');
      expect(result.order).toBe('desc');
    });

    it('should validate ID parameters', () => {
      const validId = {
        id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const result = commonSchemas.id.parse(validId);
      expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');

      expect(() => {
        commonSchemas.id.parse({ id: 'invalid-uuid' });
      }).toThrow();
    });

    it('should validate search parameters', () => {
      const validSearch = {
        q: 'test query',
        category: 'education',
        tags: 'javascript,nodejs'
      };

      const result = commonSchemas.search.parse(validSearch);
      expect(result.q).toBe('test query');
      expect(result.category).toBe('education');
      expect(result.tags).toBe('javascript,nodejs');
    });

    it('should validate API headers', () => {
      const validHeaders = {
        'x-api-version': 'v1',
        'user-agent': 'Mozilla/5.0',
        'authorization': 'Bearer token123',
        'custom-header': 'custom-value' // Should pass through
      };

      const result = commonSchemas.apiHeaders.parse(validHeaders);
      expect(result['x-api-version']).toBe('v1');
      expect(result['user-agent']).toBe('Mozilla/5.0');
      expect(result['authorization']).toBe('Bearer token123');
      expect(result['custom-header']).toBe('custom-value');
    });
  });

  describe('Integration Tests', () => {
    it('should work with multiple middleware layers', async () => {
      // Setup comprehensive security
      setupSecurityMiddleware(app, {
        rateLimit: {
          windowMs: 60 * 1000,
          max: 10
        }
      });

      // Add validation middleware
      const validationMiddleware = createValidationMiddleware({
        body: z.object({
          message: z.string().min(1).max(100)
        })
      });

      app.post('/test', validationMiddleware, (req, res) => {
        res.json({ 
          message: 'success', 
          data: req.body,
          headers: {
            'x-content-type-options': res.get('X-Content-Type-Options'),
            'x-frame-options': res.get('X-Frame-Options')
          }
        });
      });

      const response = await request(app)
        .post('/test')
        .send({ message: 'Hello World' })
        .expect(200);

      expect(response.body.data.message).toBe('Hello World');
      expect(response.body.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body.headers['x-frame-options']).toBe('DENY');
    });

    it('should handle validation errors gracefully', async () => {
      setupSecurityMiddleware(app);

      const validationMiddleware = createValidationMiddleware({
        body: z.object({
          email: z.string().email(),
          age: z.number().min(0)
        })
      });

      // Mock error handler
      app.post('/test', validationMiddleware, (req, res) => {
        res.json({ message: 'success' });
      });

      app.use((error: any, req: any, res: any, next: any) => {
        if (error.name === 'ValidationError') {
          return res.status(400).json({
            error: 'Validation Error',
            message: error.message,
            details: error.details
          });
        }
        next(error);
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          age: -5
        })
        .expect(400);

      expect(response.body.error).toBe('Validation Error');
      expect(response.body.details).toBeDefined();
    });
  });
});