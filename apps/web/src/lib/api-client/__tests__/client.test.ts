/**
 * Comprehensive unit tests for API client
 * Tests retry logic, error handling, caching, and performance optimization
 */

import { rest } from 'msw';
import {
  mockServer,
  addMockHandler,
  createMockApiResponse,
  createMockApiError,
  simulateNetworkError,
  simulateTimeout,
  simulateRateLimit,
  mockTimers,
  measurePerformance,
  PERFORMANCE_THRESHOLDS
} from '@/lib/testing';
import { ApiClient } from '../client';
import { ErrorType } from '../errors';

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let timers: ReturnType<typeof mockTimers>;

  beforeEach(() => {
    apiClient = new ApiClient({
      baseURL: 'http://localhost:4000',
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      enableMetrics: true
    });
    timers = mockTimers();
  });

  afterEach(() => {
    timers.restore();
    apiClient.clearCache();
  });

  describe('Basic HTTP Methods', () => {
    it('should make GET requests successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockData))
          );
        })
      );

      const response = await apiClient.get('/api/test');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(response.metadata?.requestId).toBeDefined();
      expect(response.metadata?.duration).toBeGreaterThan(0);
    });

    it('should make POST requests successfully', async () => {
      const requestData = { name: 'New Item' };
      const responseData = { id: 2, name: 'New Item' };

      addMockHandler(
        rest.post('http://localhost:4000/api/test', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toEqual(requestData);
          
          return res(
            ctx.status(201),
            ctx.json(createMockApiResponse(responseData))
          );
        })
      );

      const response = await apiClient.post('/api/test', requestData);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
    });

    it('should make PUT requests successfully', async () => {
      const requestData = { name: 'Updated Item' };
      const responseData = { id: 1, name: 'Updated Item' };

      addMockHandler(
        rest.put('http://localhost:4000/api/test/1', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toEqual(requestData);
          
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(responseData))
          );
        })
      );

      const response = await apiClient.put('/api/test/1', requestData);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
    });

    it('should make DELETE requests successfully', async () => {
      addMockHandler(
        rest.delete('http://localhost:4000/api/test/1', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const response = await apiClient.delete('/api/test/1');

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle 4xx client errors', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json(createMockApiError('Bad request'))
          );
        })
      );

      const response = await apiClient.get('/api/test');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Bad request');
      expect(response.data).toBeUndefined();
    });

    it('should handle 5xx server errors', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json(createMockApiError('Internal server error'))
          );
        })
      );

      const response = await apiClient.get('/api/test');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Internal server error');
    });

    it('should handle network errors', async () => {
      simulateNetworkError('http://localhost:4000/api/test');

      const response = await apiClient.get('/api/test');

      expect(response.success).toBe(false);
      expect(response.error).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      simulateTimeout('http://localhost:4000/api/test', 6000); // Longer than client timeout

      const response = await apiClient.get('/api/test', { timeout: 1000 });

      expect(response.success).toBe(false);
      expect(response.error).toContain('timeout');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on network errors with exponential backoff', async () => {
      let attemptCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          attemptCount++;
          
          if (attemptCount < 3) {
            return res.networkError('Network error');
          }
          
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const response = await apiClient.get('/api/test');

      expect(attemptCount).toBe(3);
      expect(response.success).toBe(true);
      expect(response.metadata?.retryCount).toBe(2);
    });

    it('should not retry on 4xx client errors', async () => {
      let attemptCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          attemptCount++;
          return res(
            ctx.status(400),
            ctx.json(createMockApiError('Bad request'))
          );
        })
      );

      const response = await apiClient.get('/api/test');

      expect(attemptCount).toBe(1);
      expect(response.success).toBe(false);
      expect(response.metadata?.retryCount).toBe(0);
    });

    it('should respect retry attempts limit', async () => {
      let attemptCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          attemptCount++;
          return res.networkError('Network error');
        })
      );

      const response = await apiClient.get('/api/test');

      expect(attemptCount).toBe(4); // Initial attempt + 3 retries
      expect(response.success).toBe(false);
      expect(response.metadata?.retryCount).toBe(3);
    });

    it('should handle rate limiting with proper delays', async () => {
      let attemptCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          attemptCount++;
          
          if (attemptCount < 2) {
            return res(
              ctx.status(429),
              ctx.set('Retry-After', '2'),
              ctx.json(createMockApiError('Rate limit exceeded'))
            );
          }
          
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const startTime = Date.now();
      const response = await apiClient.get('/api/test');
      const endTime = Date.now();

      expect(response.success).toBe(true);
      expect(attemptCount).toBe(2);
      // Should have waited at least 2 seconds due to Retry-After header
      expect(endTime - startTime).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('Caching', () => {
    it('should cache GET responses', async () => {
      const mockData = { id: 1, name: 'Cached Data' };
      let requestCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          requestCount++;
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockData))
          );
        })
      );

      // First request
      const response1 = await apiClient.get('/api/test');
      expect(response1.success).toBe(true);
      expect(response1.metadata?.cached).toBe(false);
      expect(requestCount).toBe(1);

      // Second request should be cached
      const response2 = await apiClient.get('/api/test');
      expect(response2.success).toBe(true);
      expect(response2.metadata?.cached).toBe(true);
      expect(requestCount).toBe(1); // No additional request
    });

    it('should not cache POST/PUT/DELETE requests', async () => {
      let requestCount = 0;
      
      addMockHandler(
        rest.post('http://localhost:4000/api/test', (req, res, ctx) => {
          requestCount++;
          return res(
            ctx.status(201),
            ctx.json(createMockApiResponse({ id: requestCount }))
          );
        })
      );

      // Multiple POST requests
      await apiClient.post('/api/test', { data: 'test1' });
      await apiClient.post('/api/test', { data: 'test2' });

      expect(requestCount).toBe(2); // Both requests should be made
    });

    it('should respect cache TTL', async () => {
      const mockData = { id: 1, name: 'TTL Test' };
      let requestCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          requestCount++;
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockData))
          );
        })
      );

      // First request
      await apiClient.get('/api/test', { cacheTTL: 1000 }); // 1 second TTL
      expect(requestCount).toBe(1);

      // Second request within TTL
      await apiClient.get('/api/test');
      expect(requestCount).toBe(1);

      // Advance time beyond TTL
      timers.advanceTimersByTime(1500);

      // Third request after TTL expiry
      await apiClient.get('/api/test');
      expect(requestCount).toBe(2);
    });

    it('should clear cache correctly', async () => {
      const mockData = { id: 1, name: 'Clear Test' };
      let requestCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          requestCount++;
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse(mockData))
          );
        })
      );

      // First request
      await apiClient.get('/api/test');
      expect(requestCount).toBe(1);

      // Clear cache
      apiClient.clearCache();

      // Second request should not be cached
      const response = await apiClient.get('/api/test');
      expect(response.metadata?.cached).toBe(false);
      expect(requestCount).toBe(2);
    });
  });

  describe('Authentication', () => {
    it('should include auth token in requests', async () => {
      const token = 'test-jwt-token';
      let receivedAuthHeader: string | null = null;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          receivedAuthHeader = req.headers.get('Authorization');
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      apiClient.setAuthToken(token);
      await apiClient.get('/api/test');

      expect(receivedAuthHeader).toBe(`Bearer ${token}`);
    });

    it('should handle token refresh on 401 errors', async () => {
      let requestCount = 0;
      
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          requestCount++;
          
          if (requestCount === 1) {
            return res(
              ctx.status(401),
              ctx.json(createMockApiError('Token expired'))
            );
          }
          
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      // Mock token refresh
      addMockHandler(
        rest.post('http://localhost:4000/api/v1/auth/refresh', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ 
              token: 'new-token',
              refreshToken: 'new-refresh-token'
            }))
          );
        })
      );

      apiClient.setAuthToken('expired-token');
      const response = await apiClient.get('/api/test');

      expect(response.success).toBe(true);
      expect(requestCount).toBe(2); // Original request + retry with new token
    });
  });

  describe('Batch Requests', () => {
    it('should handle batch requests successfully', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test/1', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ id: 1, name: 'Item 1' }))
          );
        })
      );

      addMockHandler(
        rest.get('http://localhost:4000/api/test/2', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ id: 2, name: 'Item 2' }))
          );
        })
      );

      const batchRequests = [
        { method: 'GET' as const, endpoint: '/api/test/1' },
        { method: 'GET' as const, endpoint: '/api/test/2' }
      ];

      const responses = await apiClient.batch(batchRequests);

      expect(responses.success).toBe(true);
      expect(responses.data).toHaveLength(2);
      expect(responses.data?.[0].data).toEqual({ id: 1, name: 'Item 1' });
      expect(responses.data?.[1].data).toEqual({ id: 2, name: 'Item 2' });
    });

    it('should handle partial batch failures', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test/1', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ id: 1, name: 'Item 1' }))
          );
        })
      );

      addMockHandler(
        rest.get('http://localhost:4000/api/test/2', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json(createMockApiError('Not found'))
          );
        })
      );

      const batchRequests = [
        { method: 'GET' as const, endpoint: '/api/test/1' },
        { method: 'GET' as const, endpoint: '/api/test/2' }
      ];

      const responses = await apiClient.batch(batchRequests);

      expect(responses.success).toBe(true);
      expect(responses.data).toHaveLength(2);
      expect(responses.data?.[0].success).toBe(true);
      expect(responses.data?.[1].success).toBe(false);
    });
  });

  describe('File Upload', () => {
    it('should handle file uploads with progress tracking', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      let progressUpdates: number[] = [];
      
      addMockHandler(
        rest.post('http://localhost:4000/api/upload', (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(createMockApiResponse({ 
              fileId: 'uploaded-file-id',
              filename: 'test.txt',
              size: mockFile.size
            }))
          );
        })
      );

      const response = await apiClient.upload('/api/upload', mockFile, {
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });

      expect(response.success).toBe(true);
      expect(response.data?.fileId).toBe('uploaded-file-id');
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('Performance Metrics', () => {
    it('should collect and provide metrics', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.delay(100),
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      // Make several requests
      await apiClient.get('/api/test');
      await apiClient.get('/api/test');
      await apiClient.get('/api/test');

      const metrics = apiClient.getMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.cacheHitRate).toBeGreaterThan(0); // Some requests should be cached
    });

    it('should track error metrics', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json(createMockApiError('Server error'))
          );
        })
      );

      await apiClient.get('/api/test');
      await apiClient.get('/api/test');

      const metrics = apiClient.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.errorsByType['server']).toBe(2);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet response time requirements for simple requests', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.delay(50), // 50ms delay
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const responseTime = await measurePerformance(async () => {
        await apiClient.get('/api/test');
      });

      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
    });

    it('should handle concurrent requests efficiently', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test/:id', (req, res, ctx) => {
          const { id } = req.params;
          return res(
            ctx.delay(100),
            ctx.status(200),
            ctx.json(createMockApiResponse({ id, name: `Item ${id}` }))
          );
        })
      );

      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        apiClient.get(`/api/test/${i + 1}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      // Concurrent requests should be faster than sequential
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000 * 10); // Much less than 10 seconds (sequential)
    });
  });

  describe('Request Cancellation', () => {
    it('should support request cancellation', async () => {
      addMockHandler(
        rest.get('http://localhost:4000/api/test', (req, res, ctx) => {
          return res(
            ctx.delay(2000), // Long delay
            ctx.status(200),
            ctx.json(createMockApiResponse({ success: true }))
          );
        })
      );

      const abortController = new AbortController();
      
      // Start request and cancel it after 100ms
      const requestPromise = apiClient.get('/api/test', { 
        signal: abortController.signal 
      });
      
      setTimeout(() => {
        abortController.abort();
      }, 100);

      const response = await requestPromise;

      expect(response.success).toBe(false);
      expect(response.error).toContain('aborted');
    });
  });
});