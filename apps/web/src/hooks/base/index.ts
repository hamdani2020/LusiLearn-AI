// Base Hook Utilities - Main Export
export * from './types';
export * from './cache-manager';
export * from './state-manager';
export * from './optimistic-updates';
export * from './event-emitter';
export * from './use-api-call';
export * from './use-base-hook';
export * from './use-crud-operations';
export * from './use-paginated-data';

// Re-export commonly used utilities
export { globalHookCache } from './cache-manager';
export { globalStateRegistry } from './state-manager';
export { useApiCall } from './use-api-call';
export { useBaseHook } from './use-base-hook';
export { useCrudOperations } from './use-crud-operations';
export { usePaginatedData } from './use-paginated-data';