// Base Hook Types and Interfaces

// Local ApiResponse type to avoid import issues
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
    cached: boolean;
    retryCount: number;
    source: 'api' | 'cache' | 'optimistic';
  };
}

export interface BaseHookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  isStale: boolean;
}

export interface BaseHookActions {
  clearError: () => void;
  clearData: () => void;
  refresh: () => Promise<void>;
  invalidate: () => void;
}

export interface HookOptions {
  autoFetch?: boolean;
  cacheTime?: number;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onLoading?: (loading: boolean) => void;
}

export interface OptimisticUpdate<T> {
  id: string;
  data: Partial<T>;
  timestamp: Date;
  rollback?: () => void;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  stale: boolean;
}

export interface ApiCallOptions extends HookOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload?: any;
  dependencies?: any[];
}

export interface UseApiCallReturn<T> extends BaseHookState<T>, BaseHookActions {
  execute: (payload?: any) => Promise<T | null>;
  cancel: () => void;
  retry: () => Promise<void>;
}

export interface StateManager<T> {
  get: () => T | null;
  set: (data: T | null) => void;
  update: (updater: (current: T | null) => T | null) => void;
  subscribe: (callback: (data: T | null) => void) => () => void;
  clear: () => void;
}

export interface CacheManager<T = any> {
  get: <U = T>(key: string) => CacheEntry<U> | null;
  set: <U = T>(key: string, data: U, ttl?: number) => void;
  invalidate: (key: string) => void;
  clear: () => void;
  isStale: (key: string) => boolean;
  cleanup: () => void;
}

export interface OptimisticUpdateManager<T> {
  apply: (id: string, update: Partial<T>) => void;
  rollback: (id: string) => void;
  confirm: (id: string) => void;
  getPending: () => OptimisticUpdate<T>[];
  clear: () => void;
}

export type HookEventType = 'loading' | 'success' | 'error' | 'stale' | 'refresh';

export interface HookEvent<T> {
  type: HookEventType;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface HookEventEmitter<T> {
  emit: (event: HookEvent<T>) => void;
  on: (type: HookEventType, callback: (event: HookEvent<T>) => void) => () => void;
  off: (type: HookEventType, callback: (event: HookEvent<T>) => void) => void;
  clear: () => void;
}