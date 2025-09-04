// Base Hook Utilities
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BaseHookState,
  BaseHookActions,
  HookOptions,
  OptimisticUpdate
} from './types';
import { globalHookCache } from './cache-manager';
import { HookOptimisticUpdateManager } from './optimistic-updates';
import { HookEventEmitterImpl } from './event-emitter';

export interface UseBaseHookOptions extends HookOptions {
  cacheKey?: string;
  enableOptimisticUpdates?: boolean;
}

export function useBaseHook<T>(
  initialData: T | null = null,
  options: UseBaseHookOptions = {}
) {
  const {
    cacheKey,
    cacheTime = 5 * 60 * 1000,
    staleTime = 30 * 1000,
    enableOptimisticUpdates = false,
    onSuccess,
    onError,
    onLoading
  } = options;

  // State
  const [state, setState] = useState<BaseHookState<T>>({
    data: initialData,
    loading: false,
    error: null,
    lastFetch: null,
    isStale: false
  });

  // Managers
  const optimisticManagerRef = useRef(new HookOptimisticUpdateManager<T>());
  const eventEmitterRef = useRef(new HookEventEmitterImpl<T>());

  // Update state helper
  const updateState = useCallback((updates: Partial<BaseHookState<T>>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Set data with caching
  const setData = useCallback((data: T | null, fromCache = false) => {
    const now = new Date();

    updateState({
      data,
      lastFetch: fromCache ? state.lastFetch : now,
      isStale: false,
      error: null
    });

    // Cache if key provided and not from cache
    if (cacheKey && !fromCache && data) {
      globalHookCache.set(cacheKey, data, cacheTime);
    }

    if (data) {
      eventEmitterRef.current.emit({
        type: 'success',
        data,
        timestamp: now
      });
      onSuccess?.(data);
    }
  }, [cacheKey, cacheTime, state.lastFetch, updateState, onSuccess]);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    updateState({ loading });

    if (loading) {
      eventEmitterRef.current.emit({
        type: 'loading',
        timestamp: new Date()
      });
    }

    onLoading?.(loading);
  }, [updateState, onLoading]);

  // Set error state
  const setError = useCallback((error: string | null) => {
    updateState({ error, loading: false });

    if (error) {
      eventEmitterRef.current.emit({
        type: 'error',
        error,
        timestamp: new Date()
      });
      onError?.(error);
    }
  }, [updateState, onError]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Clear data
  const clearData = useCallback(() => {
    updateState({ data: null, isStale: false });
    if (cacheKey) {
      globalHookCache.invalidate(cacheKey);
    }
  }, [updateState, cacheKey]);

  // Refresh (mark as stale and emit event)
  const refresh = useCallback(async (): Promise<void> => {
    if (cacheKey) {
      globalHookCache.invalidate(cacheKey);
    }
    updateState({ isStale: true });

    eventEmitterRef.current.emit({
      type: 'refresh',
      timestamp: new Date()
    });
  }, [cacheKey, updateState]);

  // Invalidate cache
  const invalidate = useCallback(() => {
    if (cacheKey) {
      globalHookCache.invalidate(cacheKey);
    }
    updateState({ isStale: true });

    eventEmitterRef.current.emit({
      type: 'stale',
      data: state.data || undefined,
      timestamp: new Date()
    });
  }, [cacheKey, updateState, state.data]);

  // Optimistic update methods
  const applyOptimisticUpdate = useCallback((id: string, update: Partial<T>) => {
    if (!enableOptimisticUpdates) return;

    optimisticManagerRef.current.apply(id, update);

    // Apply to current data if it's an array
    if (Array.isArray(state.data)) {
      const updatedData = optimisticManagerRef.current.applyToData(state.data as any[]);
      updateState({ data: updatedData as T });
    }
  }, [enableOptimisticUpdates, state.data, updateState]);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    if (!enableOptimisticUpdates) return;

    optimisticManagerRef.current.rollback(id);

    // Revert data changes - would need original data tracking for full implementation
    // For now, just trigger a refresh
    refresh();
  }, [enableOptimisticUpdates, refresh]);

  const confirmOptimisticUpdate = useCallback((id: string) => {
    if (!enableOptimisticUpdates) return;

    optimisticManagerRef.current.confirm(id);
  }, [enableOptimisticUpdates]);

  // Check cache on mount
  useEffect(() => {
    if (cacheKey && !state.data) {
      const cached = globalHookCache.get<T>(cacheKey);
      if (cached) {
        setData(cached.data, true);
        if (cached.stale) {
          updateState({ isStale: true });
        }
      }
    }
  }, [cacheKey, state.data, setData, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventEmitterRef.current.clear();
      optimisticManagerRef.current.clear();
    };
  }, []);

  const actions: BaseHookActions = {
    clearError,
    clearData,
    refresh,
    invalidate
  };

  const optimisticActions = enableOptimisticUpdates ? {
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    confirmOptimisticUpdate,
    getPendingUpdates: () => optimisticManagerRef.current.getPending()
  } : {};

  const utils = {
    setData,
    setLoading,
    setError,
    eventEmitter: eventEmitterRef.current,
    optimisticManager: optimisticManagerRef.current
  };

  return {
    ...state,
    ...actions,
    ...optimisticActions,
    ...utils
  };
}