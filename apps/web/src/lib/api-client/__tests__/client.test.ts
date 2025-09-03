import { EnhancedApiClient, createApiClient } from '../client';
import { EnhancedApiError } from '../errors';
import { ErrorType } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('EnhancedApiClient', () => {
  let client: EnhancedApiClient;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = createApiClient({
      baseURL: 'http://localhost:4000',
      enableLogging: false,
      enableMetrics: false
    });
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic HTTP Methods', () => {
    it('should make GET requests successfully', async () => {
      const mockResponse = {
        success: true,
        data: { id: 1, name: 'Test' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const result = await client.get('/api/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should make POST requests with data', async () => {
      const requestData = { name: 'New Item' };
      const mockResponse = {
        success: true,
        data: { id: 2, ...requestData }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response);

      const result = await client.post('/api/items', requestData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle PUT requests', async () => {
      const updateData = { name: 'Updated Item' };
      const mockResponse = {
        success: true,
        data: { id: 1, ...updateData }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response);

      const result = await client.put('/api/items/1', updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
    });

    it('should handle DELETE requests', async () => {
      const mockResponse = { success: true };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => mockResponse
      } as Response);

      const result = await client.delete('/api/items/1');

      expect(result.success).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should include auth token in requests', async () => {
      const token = 'test-token-123';
      client.setAuthToken(token);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await client.get('/api/protected');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/protected',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      );
    });

    it('should clear auth token', () => {
      // Mock localStorage before setting token
      const mockLocalStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });

      client.setAuthToken('test-token');
      client.clearAuthToken();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.get('/api/test')).rejects.toThrow(EnhancedApiError);
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' })
      } as Response);

      await expect(client.get('/api/nonexistent')).rejects.toThrow(EnhancedApiError);
    });

    it('should handle timeout errors', async () => {
      // Mock a timeout scenario
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new DOMException('AbortError', 'AbortError')), 100)
        )
      );

      await expect(
        client.get('/api/slow', { timeout: 50 })
      ).rejects.toThrow(EnhancedApiError);
    });
  });

  describe('Request Options', () => {
    it('should respect custom timeout', async () => {
      const customTimeout = 5000;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await client.get('/api/test', { timeout: customTimeout });

      // Verify that the request was made (timeout handling is internal)
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle custom headers', async () => {
      const customHeaders = { 'X-Custom-Header': 'test-value' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await client.get('/api/test', { headers: customHeaders });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining(customHeaders)
        })
      );
    });
  });

  describe('Interceptors', () => {
    it('should apply request interceptors', async () => {
      const interceptor = {
        onRequest: jest.fn((config) => ({
          ...config,
          headers: {
            ...config.headers,
            'X-Intercepted': 'true'
          }
        }))
      };

      client.addInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await client.get('/api/test');

      expect(interceptor.onRequest).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Intercepted': 'true'
          })
        })
      );
    });

    it('should apply response interceptors', async () => {
      const interceptor = {
        onResponse: jest.fn((response) => response)
      };

      client.addInterceptor(interceptor);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} })
      } as Response);

      await client.get('/api/test');

      expect(interceptor.onResponse).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should return true for healthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as Response);

      const isHealthy = await client.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy API', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const isHealthy = await client.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });
});