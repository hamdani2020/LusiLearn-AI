#!/usr/bin/env tsx

/**
 * Security Middleware Demonstration
 * 
 * This script demonstrates the security middleware features implemented in task 8.2:
 * - Rate limiting to prevent API abuse
 * - CORS configuration for frontend access
 * - Request validation middleware using Zod schemas
 * - Security headers and HTTPS enforcement
 */

import express from 'express';
import { z } from 'zod';
import {
  setupSecurityMiddleware,
  createValidationMiddleware,
  createEndpointSecurity,
  commonSchemas,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit
} from '../middleware/security';

const app = express();
const PORT = 3002; // Different port to avoid conflicts

// Setup comprehensive security middleware
setupSecurityMiddleware(app, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute for demo
    max: 10, // 10 requests per minute
  },
  https: {
    enforceHttps: false, // Disabled for demo
    trustProxy: true,
  },
});

// Basic middleware
app.use(express.json());

// Demo endpoint with validation
const userSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().min(13).max(120),
  preferences: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean(),
  }).optional(),
});

app.post('/api/demo/users', 
  createValidationMiddleware({ body: userSchema }),
  (req, res) => {
    res.json({
      success: true,
      message: 'User data validated successfully',
      data: req.body,
      securityHeaders: {
        'x-content-type-options': res.get('X-Content-Type-Options'),
        'x-frame-options': res.get('X-Frame-Options'),
        'x-xss-protection': res.get('X-XSS-Protection'),
      }
    });
  }
);

// Demo endpoint with pagination validation
app.get('/api/demo/items',
  createValidationMiddleware({ query: commonSchemas.pagination }),
  (req, res) => {
    res.json({
      success: true,
      message: 'Pagination parameters validated',
      query: req.query,
      items: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `This is demo item ${i + 1}`
      }))
    });
  }
);

// Demo endpoint with strict rate limiting (auth-like)
app.post('/api/demo/auth/login',
  authRateLimit, // Very restrictive rate limit
  createValidationMiddleware({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(8),
    })
  }),
  (req, res) => {
    res.json({
      success: true,
      message: 'Login attempt validated (demo only)',
      rateLimitInfo: {
        limit: 'Very restrictive (5 requests per 15 minutes)',
        remaining: res.get('X-RateLimit-Remaining'),
        reset: res.get('X-RateLimit-Reset'),
      }
    });
  }
);

// Demo endpoint with file upload rate limiting
app.post('/api/demo/upload',
  uploadRateLimit, // Upload-specific rate limit
  createValidationMiddleware({
    body: z.object({
      filename: z.string().min(1),
      size: z.number().positive(),
      type: z.string(),
    })
  }),
  (req, res) => {
    res.json({
      success: true,
      message: 'File upload validated (demo only)',
      data: req.body,
      rateLimitInfo: {
        limit: 'Upload limit (10 per hour)',
        remaining: res.get('X-RateLimit-Remaining'),
      }
    });
  }
);

// Demo endpoint showing input sanitization
app.post('/api/demo/sanitize',
  (req, res) => {
    res.json({
      success: true,
      message: 'Input sanitized automatically by security middleware',
      original: 'Check the request body - any malicious scripts should be sanitized',
      sanitized: req.body,
      note: 'Script tags, javascript: protocols, and event handlers are removed'
    });
  }
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    securityFeatures: {
      rateLimiting: 'enabled',
      cors: 'configured',
      inputSanitization: 'enabled',
      securityHeaders: 'enabled',
      requestValidation: 'available',
    }
  });
});

// Error handling
app.use((error: any, req: any, res: any, next: any) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      details: error.details,
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'POST /api/demo/users - User creation with validation',
      'GET /api/demo/items - Paginated items with query validation',
      'POST /api/demo/auth/login - Login with strict rate limiting',
      'POST /api/demo/upload - File upload with upload rate limiting',
      'POST /api/demo/sanitize - Input sanitization demo',
      'GET /health - Health check',
    ]
  });
});

// Start the demo server
app.listen(PORT, () => {
  console.log(`🔒 Security Middleware Demo Server running on port ${PORT}`);
  console.log(`\n📋 Available demo endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/demo/users`);
  console.log(`   GET  http://localhost:${PORT}/api/demo/items?page=1&limit=5`);
  console.log(`   POST http://localhost:${PORT}/api/demo/auth/login`);
  console.log(`   POST http://localhost:${PORT}/api/demo/upload`);
  console.log(`   POST http://localhost:${PORT}/api/demo/sanitize`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  
  console.log(`\n🧪 Test examples:`);
  console.log(`   # Test rate limiting (try multiple requests quickly)`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/demo/users -H "Content-Type: application/json" -d '{"name":"John","email":"john@example.com","age":25}'`);
  
  console.log(`\n   # Test validation (this should fail)`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/demo/users -H "Content-Type: application/json" -d '{"name":"","email":"invalid","age":-5}'`);
  
  console.log(`\n   # Test input sanitization`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/demo/sanitize -H "Content-Type: application/json" -d '{"name":"<script>alert(\\"xss\\")</script>John","content":"javascript:alert(\\"xss\\")","onclick":"alert(\\"click\\")"}'`);
  
  console.log(`\n   # Test CORS (from browser console on different origin)`);
  console.log(`   fetch('http://localhost:${PORT}/health').then(r => r.json()).then(console.log)`);
  
  console.log(`\n   # Check security headers`);
  console.log(`   curl -I http://localhost:${PORT}/health`);
});

export default app;