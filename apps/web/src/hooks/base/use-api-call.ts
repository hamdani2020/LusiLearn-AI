// Core useApiCall Hook Implementation
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  UseApiCallReturn,
  ApiCallOptions,
  BaseHookState,
  HookEvent,
  ApiResponse
} from './types';
import { globalHookCache } from './cache-manager';
import { HookEventEmitterImpl } from './event-emitter';

// Mock API client for testing - in real implementation, this would be imported
const mockApiClient = {
  get: async <T>(endpoint: string, options?: any): Promise<ApiResponse<T>> => {
    return { success: true, data: {} as T };
  },
  post: async <T>(endpoint: string, data?: any, options?: any): Promise<ApiResponse<T>> => {
    return { success: true, data: {} as T };
  },
  put: async <T>(endpoint: string, data?: any, options?: any): Promise<ApiResponse<T>> => {
    return { success: true, data: {} as T };
  },
  patch: async <T>(endpoint: string, data?: any, options?: any): Promise<ApiResponse<T>> => {
    return { success: true, data: {} as T };
  },
  delete: async <T>(endpoint: string, options?: any): Promise<ApiResponse<T>> => {
    return { success: true, data: {} as T };
  }
};

export function useApiCall<T>(options: ApiCallOptions): UseApiCallReturn<T> {
  const {
    endpoint,
    method = 'GET',
    payload: initialPayload,
    dependencies = [],
    autoFetch = false,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 30 * 1000, // 30 seconds
    refetchOnWindowFocus = false,
    refetchOnReconnect = true,
    retryOnError = true,
    maxRetries = 3,
    onSuccess,
    onError,
    onLoading
  } = options;

  // State
  const [state, setState] = useState<BaseHookState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    isStale: false
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const eventEmitterRef = useRef(new HookEventEmitterImpl<T>());

  // Cache key
  const cacheKey = `${method}:${endpoint}:${JSON.stringify(initialPayload || {})}`;

  // Update state helper
  const updateState = useCallback((updates: Partial<BaseHookState<T>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Emit event helper
  const emitEvent = useCallback((type: HookEvent<T>['type'], data?: T, error?: string) => {
    eventEmitterRef.current.emit({
      type,
      data,
      error,
      timestamp: new Date()
    });
  }, []);

  // Check cache
  const getCachedData = useCallback((): T | null => {
    const cached = globalHookCache.get<T>(cacheKey);
    if (cached) {
      updateState({
        data: cached.data,
        isStale: cached.stale,
        lastFetch: cached.timestamp
      });

      if (cached.stale) {
        emitEvent('stale', cached.data);
      }

      return cached.data;
    }
    return null;
  }, [cacheKey, updateState, emitEvent]);

  // Execute API call
  const execute = useCallback(async (payload?: any): Promise<T | null> => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Check cache first for GET requests
    if (method === 'GET') {
      const cachedData = getCachedData();
      if (cachedData && !globalHookCache.isStale(cacheKey)) {
        return cachedData;
      }
    }

    updateState({ loading: true, error: null });
    emitEvent('loading');
    onLoading?.(true);

    try {
      let response: ApiResponse<T>;
      const requestPayload = payload || initialPayload;
      const requestOptions = {
        signal: abortControllerRef.current.signal
      };

      switch (method) {
        case 'GET':
          response = await mockApiClient.get<T>(endpoint, requestOptions);
          break;
        case 'POST':
          response = await mockApiClient.post<T>(endpoint, requestPayload, requestOptions);
          break;
        case 'PUT':
          response = await mockApiClient.put<T>(endpoint, requestPayload, requestOptions);
          break;
        case 'PATCH':
          response = await mockApiClient.patch<T>(endpoint, requestPayload, requestOptions);
          break;
        case 'DELETE':
          response = await mockApiClient.delete<T>(endpoint, requestOptions);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      if (response.success && response.data) {
        const now = new Date();

        // Update state
        updateState({
          data: response.data,
          loading: false,
          error: null,
          lastFetch: now,
          isStale: false
        });

        // Cache the result for GET requests
        if (method === 'GET') {
          globalHookCache.set(cacheKey, response.data, cacheTime);
        }

        // Reset retry count on success
        retryCountRef.current = 0;

        // Emit success event and call callback
        emitEvent('success', response.data);
        onSuccess?.(response.data);
        onLoading?.(false);

        return response.data;
      } else {
        const errorMessage = response.error || response.message || 'Request failed';

        updateState({
          loading: false,
          error: errorMessage
        });

        emitEvent('error', undefined, errorMessage);
        onError?.(errorMessage);
        onLoading?.(false);

        return null;
      }
    } catch (error: any) {
      // Don't handle aborted requests as errors
      if (error.name === 'AbortError') {
        return null;
      }

      const errorMessage = error.message || 'An unexpected error occurred';

      updateState({
        loading: false,
        error: errorMessage
      });

      emitEvent('error', undefined, errorMessage);
      onError?.(errorMessage);
      onLoading?.(false);

      // Retry logic
      if (retryOnError && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);

        setTimeout(() => {
          execute(payload);
        }, delay);
      }

      return null;
    }
  }, [
    method,
    endpoint,
    initialPayload,
    cacheKey,
    cacheTime,
    getCachedData,
    updateState,
    emitEvent,
    onSuccess,
    onError,
    onLoading,
    retryOnError,
    maxRetries
  ]);

  // Cancel current request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    updateState({ loading: false });
    onLoading?.(false);
  }, [updateState, onLoading]);

  // Retry current request
  const retry = useCallback(async (): Promise<void> => {
    retryCountRef.current = 0;
    await execute();
  }, [execute]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Clear data
  const clearData = useCallback(() => {
    updateState({ data: null, isStale: false });
    globalHookCache.invalidate(cacheKey);
  }, [updateState, cacheKey]);

  // Refresh data
  const refresh = useCallback(async (): Promise<void> => {
    globalHookCache.invalidate(cacheKey);
    await execute();
    emitEvent('refresh');
  }, [execute, cacheKey, emitEvent]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    globalHookCache.invalidate(cacheKey);
    updateState({ isStale: true });
    emitEvent('stale', state.data || undefined);
  }, [cacheKey, updateState, emitEvent, state.data]);

  // Auto-fetch on mount or dependency change
  useEffect(() => {
    if (autoFetch) {
      execute();
    }
  }, [autoFetch, execute, ...dependencies]);

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (state.data && globalHookCache.isStale(cacheKey)) {
        execute();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, state.data, cacheKey, execute]);

  // Online/offline refetch
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (state.data) {
        execute();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refetchOnReconnect, state.data, execute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
      eventEmitterRef.current.clear();
    };
  }, [cancel]);

  return {
    ...state,
    execute,
    cancel,
    retry,
    clearError,
    clearData,
    refresh,
    invalidate
  };
}