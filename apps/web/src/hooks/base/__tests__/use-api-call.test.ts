// Tests for useApiCall hook
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApiCall } from '../use-api-call';
import { apiClient } from '@/lib/api-client/client';

// Mock the API client
jest.mock('@/lib/api-client/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  }
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useApiCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetch).toBeNull();
    expect(result.current.isStale).toBe(false);
  });

  it('should execute GET request successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: mockData,
      metadata: {
        requestId: '123',
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(mockApiClient.get).toHaveBeenCalledWith('/test', expect.any(Object));
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'API Error';
    mockApiClient.get.mockResolvedValue({
      success: false,
      error: errorMessage
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  it('should execute POST request with payload', async () => {
    const mockData = { id: 1, name: 'Created' };
    const payload = { name: 'Test' };
    
    mockApiClient.post.mockResolvedValue({
      success: true,
      data: mockData,
      metadata: {
        requestId: '123',
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'POST'
      })
    );

    act(() => {
      result.current.execute(payload);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockApiClient.post).toHaveBeenCalledWith('/test', payload, expect.any(Object));
  });

  it('should auto-fetch when autoFetch is true', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: mockData,
      metadata: {
        requestId: '123',
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    });

    renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET',
        autoFetch: true
      })
    );

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/test', expect.any(Object));
    });
  });

  it('should cancel request when cancel is called', async () => {
    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    act(() => {
      result.current.execute();
      result.current.cancel();
    });

    expect(result.current.loading).toBe(false);
  });

  it('should clear error when clearError is called', async () => {
    mockApiClient.get.mockResolvedValue({
      success: false,
      error: 'Test error'
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Test error');
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should retry request when retry is called', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: mockData,
      metadata: {
        requestId: '123',
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET'
      })
    );

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/test', expect.any(Object));
    });
  });

  it('should call success callback on successful request', async () => {
    const mockData = { id: 1, name: 'Test' };
    const onSuccess = jest.fn();
    
    mockApiClient.get.mockResolvedValue({
      success: true,
      data: mockData,
      metadata: {
        requestId: '123',
        timestamp: new Date().toISOString(),
        duration: 100,
        cached: false,
        retryCount: 0,
        source: 'api'
      }
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET',
        onSuccess
      })
    );

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it('should call error callback on failed request', async () => {
    const errorMessage = 'API Error';
    const onError = jest.fn();
    
    mockApiClient.get.mockResolvedValue({
      success: false,
      error: errorMessage
    });

    const { result } = renderHook(() =>
      useApiCall({
        endpoint: '/test',
        method: 'GET',
        onError
      })
    );

    act(() => {
      result.current.execute();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });
  });
});