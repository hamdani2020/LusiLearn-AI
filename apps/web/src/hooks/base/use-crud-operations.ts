// CRUD Operations Hook Utility
import { useCallback } from 'react';
import { useApiCall } from './use-api-call';
import { useBaseHook } from './use-base-hook';
import { HookOptions } from './types';

export interface CrudEndpoints {
  getAll: string;
  getById: string;
  create: string;
  update: string;
  delete: string;
}

export interface UseCrudOperationsOptions extends HookOptions {
  endpoints: CrudEndpoints;
  cacheKey?: string;
  enableOptimisticUpdates?: boolean;
}

export function useCrudOperations<T extends { id: string }, CreateData, UpdateData>(
  options: UseCrudOperationsOptions
) {
  const {
    endpoints,
    cacheKey = 'crud-data',
    enableOptimisticUpdates = true,
    ...hookOptions
  } = options;

  // Base hook for managing state
  const baseHook = useBaseHook<T[]>([], {
    cacheKey,
    enableOptimisticUpdates,
    ...hookOptions
  });

  // API calls
  const getAllCall = useApiCall<T[]>({
    endpoint: endpoints.getAll,
    method: 'GET',
    cacheTime: 5 * 60 * 1000,
    ...hookOptions
  });

  const getByIdCall = useApiCall<T>({
    endpoint: endpoints.getById,
    method: 'GET',
    autoFetch: false,
    ...hookOptions
  });

  const createCall = useApiCall<T>({
    endpoint: endpoints.create,
    method: 'POST',
    autoFetch: false,
    ...hookOptions
  });

  const updateCall = useApiCall<T>({
    endpoint: endpoints.update,
    method: 'PUT',
    autoFetch: false,
    ...hookOptions
  });

  const deleteCall = useApiCall<boolean>({
    endpoint: endpoints.delete,
    method: 'DELETE',
    autoFetch: false,
    ...hookOptions
  });

  // Fetch all items
  const fetchAll = useCallback(async (): Promise<T[] | null> => {
    baseHook.setLoading(true);
    const result = await getAllCall.execute();
    
    if (result) {
      baseHook.setData(result);
    } else if (getAllCall.error) {
      baseHook.setError(getAllCall.error);
    }
    
    baseHook.setLoading(false);
    return result;
  }, [getAllCall, baseHook]);

  // Fetch single item
  const fetchById = useCallback(async (id: string): Promise<T | null> => {
    const endpoint = endpoints.getById.replace(':id', id);
    const result = await getByIdCall.execute();
    return result;
  }, [getByIdCall, endpoints.getById]);

  // Create item with optimistic update
  const create = useCallback(async (data: CreateData): Promise<T | null> => {
    baseHook.setLoading(true);
    
    let tempId: string | null = null;
    
    // Optimistic update - add temporary item
    if (enableOptimisticUpdates && baseHook.data) {
      tempId = `temp-${Date.now()}`;
      const tempItem = { ...data, id: tempId } as unknown as T;
      
      // Directly update the data array
      baseHook.setData([...baseHook.data, tempItem]);
    }

    const result = await createCall.execute(data);
    
    if (result) {
      // Replace optimistic update with real data
      if (enableOptimisticUpdates && baseHook.data && tempId) {
        const updatedData = baseHook.data.filter(item => item.id !== tempId);
        baseHook.setData([...updatedData, result]);
      } else if (baseHook.data) {
        baseHook.setData([...baseHook.data, result]);
      }
    } else {
      // Rollback optimistic update
      if (enableOptimisticUpdates && tempId && baseHook.data) {
        const rolledBackData = baseHook.data.filter(item => item.id !== tempId);
        baseHook.setData(rolledBackData);
      }
      if (createCall.error) {
        baseHook.setError(createCall.error);
      }
    }
    
    baseHook.setLoading(false);
    return result;
  }, [createCall, baseHook, enableOptimisticUpdates]);

  // Update item with optimistic update
  const update = useCallback(async (id: string, data: UpdateData): Promise<T | null> => {
    baseHook.setLoading(true);
    
    let originalItem: T | null = null;
    
    // Optimistic update
    if (enableOptimisticUpdates && baseHook.data) {
      // Store original item for potential rollback
      originalItem = baseHook.data.find(item => item.id === id) || null;
      
      const optimisticData = baseHook.data.map(item => 
        item.id === id ? { ...item, ...data } : item
      );
      baseHook.setData(optimisticData);
    }

    const endpoint = endpoints.update.replace(':id', id);
    const result = await updateCall.execute(data);
    
    if (result) {
      // Replace optimistic update with real data
      if (baseHook.data) {
        const updatedData = baseHook.data.map(item => 
          item.id === id ? result : item
        );
        baseHook.setData(updatedData);
      }
    } else {
      // Rollback optimistic update
      if (enableOptimisticUpdates && originalItem && baseHook.data) {
        const rolledBackData = baseHook.data.map(item => 
          item.id === id ? originalItem! : item
        );
        baseHook.setData(rolledBackData);
      }
      if (updateCall.error) {
        baseHook.setError(updateCall.error);
      }
    }
    
    baseHook.setLoading(false);
    return result;
  }, [updateCall, baseHook, enableOptimisticUpdates, endpoints.update]);

  // Delete item with optimistic update
  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    baseHook.setLoading(true);
    
    // Optimistic update - remove item
    let deletedItem: T | null = null;
    if (enableOptimisticUpdates && baseHook.data) {
      // Store deleted item for potential rollback
      deletedItem = baseHook.data.find(item => item.id === id) || null;
      const filteredData = baseHook.data.filter(item => item.id !== id);
      baseHook.setData(filteredData);
    }

    const endpoint = endpoints.delete.replace(':id', id);
    const result = await deleteCall.execute();
    
    if (result) {
      // Deletion confirmed - data already updated optimistically
      // No additional action needed
    } else {
      // Rollback optimistic update
      if (enableOptimisticUpdates && deletedItem && baseHook.data) {
        const rolledBackData = [...baseHook.data, deletedItem];
        baseHook.setData(rolledBackData);
      }
      if (deleteCall.error) {
        baseHook.setError(deleteCall.error);
      }
    }
    
    baseHook.setLoading(false);
    return result || false;
  }, [deleteCall, baseHook, enableOptimisticUpdates, endpoints.delete]);

  // Refresh all data
  const refresh = useCallback(async (): Promise<void> => {
    await fetchAll();
  }, [fetchAll]);

  return {
    // State
    data: baseHook.data,
    loading: baseHook.loading || getAllCall.loading || createCall.loading || updateCall.loading || deleteCall.loading,
    error: baseHook.error || getAllCall.error || createCall.error || updateCall.error || deleteCall.error,
    lastFetch: baseHook.lastFetch,
    isStale: baseHook.isStale,

    // Actions
    fetchAll,
    fetchById,
    create,
    update,
    delete: deleteItem,
    refresh,
    clearError: baseHook.clearError,
    clearData: useCallback(() => {
      baseHook.setData([]);
    }, [baseHook]),
    invalidate: baseHook.invalidate,

    // Optimistic update methods (pass through from baseHook)
    applyOptimisticUpdate: baseHook.applyOptimisticUpdate,
    rollbackOptimisticUpdate: baseHook.rollbackOptimisticUpdate,
    confirmOptimisticUpdate: baseHook.confirmOptimisticUpdate,
    getPendingUpdates: baseHook.getPendingUpdates,

    // Additional utility methods
    setData: baseHook.setData,
    setLoading: baseHook.setLoading,
    setError: baseHook.setError,

    // Computed
    hasData: (baseHook.data?.length || 0) > 0,
    itemCount: baseHook.data?.length || 0,

    // Individual call states for granular loading states
    states: {
      getAll: { loading: getAllCall.loading, error: getAllCall.error },
      getById: { loading: getByIdCall.loading, error: getByIdCall.error },
      create: { loading: createCall.loading, error: createCall.error },
      update: { loading: updateCall.loading, error: updateCall.error },
      delete: { loading: deleteCall.loading, error: deleteCall.error }
    }
  };
}