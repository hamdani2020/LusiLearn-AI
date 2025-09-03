import { createApiClient } from '../client';

// Mock fetch globally
global.fetch = jest.fn();

describe('Enhanced API Client Integration', () => {
  let apiClient: ReturnType<typeof createApiClient>;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    apiClient = createApiClient({
      baseURL: 'http://localhost:4000',
      enableLogging: false,
      enableMetrics: true,
      cacheEnabled: false // Disable cache for cleaner tests
    });
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic API Operations', () => {
    it('should perform GET request successfully', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'Test User' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const result = await apiClient.get('/api/users/1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/users/1',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should perform POST request with data', async () => {
      const requestData = { name: 'New User', email: 'test@example.com' };
      const mockResponse = {
        success: true,
        data: { id: 2, ...requestData }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response);

      const result = await apiClient.post('/api/users', requestData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData)
        })
      );
    });
  });

  describe('Authentication', () => {
    it('should include auth token in requests', async () => {
      const token = 'test-token-123';
      apiClient.setAuthToken(token);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await apiClient.get('/api/protected');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      );
    });
  });

  describe('Batch Operations', () => {
    it('should execute batch requests', async () => {
      const requests = [
        { id: '1', method: 'GET' as const, endpoint: '/api/users/1' },
        { id: '2', method: 'GET' as const, endpoint: '/api/users/2' }
      ];

      // Mock responses for each request
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 1, name: 'User 1' } })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 2, name: 'User 2' } })
        } as Response);

      const result = await apiClient.batch(requests);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'Cached User' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      // First request - should hit the API
      const result1 = await apiClient.get('/api/users/1', { cache: true });
      expect(result1.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request - should hit the cache
      const result2 = await apiClient.get('/api/users/1', { cache: true });
      expect(result2.success).toBe(true);
      expect(result2.metadata?.cached).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should clear cache when requested', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'User' }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      // Make a cached request
      await apiClient.get('/api/users/1', { cache: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      apiClient.clearCache();

      // Make the same request - should hit API again
      await apiClient.get('/api/users/1', { cache: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect request metrics', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await apiClient.get('/api/test');

      const metrics = apiClient.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should track request history', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await apiClient.get('/api/test');

      const history = apiClient.getRequestHistory();
      expect(history).toHaveLength(1);
      expect(history[0].endpoint).toBe('/api/test');
      expect(history[0].method).toBe('GET');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.get('/api/test')).rejects.toThrow();

      const metrics = apiClient.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' })
      } as Response);

      await expect(apiClient.get('/api/nonexistent')).rejects.toThrow();

      const metrics = apiClient.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should return true for healthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as Response);

      const isHealthy = await apiClient.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy API', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const isHealthy = await apiClient.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });
});