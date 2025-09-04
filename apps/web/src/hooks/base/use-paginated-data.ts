// Paginated Data Hook Utility
import { useState, useCallback, useEffect } from 'react';
import { useApiCall } from './use-api-call';
import { HookOptions } from './types';

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UsePaginatedDataOptions extends HookOptions {
  endpoint: string;
  initialParams?: Partial<PaginationParams>;
  enableInfiniteScroll?: boolean;
}

export function usePaginatedData<T>(options: UsePaginatedDataOptions) {
  const {
    endpoint,
    initialParams = {},
    enableInfiniteScroll = false,
    ...hookOptions
  } = options;

  // Pagination state
  const [params, setParams] = useState<PaginationParams>({
    page: 1,
    limit: 20,
    ...initialParams
  });

  // Accumulated data for infinite scroll
  const [accumulatedData, setAccumulatedData] = useState<T[]>([]);

  // API call
  const apiCall = useApiCall<PaginatedResponse<T>>({
    endpoint,
    method: 'GET',
    payload: params,
    dependencies: [params],
    autoFetch: true,
    ...hookOptions
  });

  // Update accumulated data when new data arrives
  useEffect(() => {
    if (apiCall.data?.data) {
      if (enableInfiniteScroll && params.page > 1) {
        // Append to existing data for infinite scroll
        setAccumulatedData(prev => [...prev, ...apiCall.data!.data]);
      } else {
        // Replace data for regular pagination
        setAccumulatedData(apiCall.data.data);
      }
    }
  }, [apiCall.data, enableInfiniteScroll, params.page]);

  // Navigation methods
  const goToPage = useCallback((page: number) => {
    if (!enableInfiniteScroll) {
      setAccumulatedData([]); // Clear data for regular pagination
    }
    setParams(prev => ({ ...prev, page }));
  }, [enableInfiniteScroll]);

  const nextPage = useCallback(() => {
    if (apiCall.data?.pagination.hasNext) {
      goToPage(params.page + 1);
    }
  }, [apiCall.data?.pagination.hasNext, params.page, goToPage]);

  const prevPage = useCallback(() => {
    if (apiCall.data?.pagination.hasPrev && !enableInfiniteScroll) {
      goToPage(params.page - 1);
    }
  }, [apiCall.data?.pagination.hasPrev, params.page, goToPage, enableInfiniteScroll]);

  const firstPage = useCallback(() => {
    if (!enableInfiniteScroll) {
      goToPage(1);
    }
  }, [goToPage, enableInfiniteScroll]);

  const lastPage = useCallback(() => {
    if (apiCall.data?.pagination.totalPages && !enableInfiniteScroll) {
      goToPage(apiCall.data.pagination.totalPages);
    }
  }, [apiCall.data?.pagination.totalPages, goToPage, enableInfiniteScroll]);

  // Load more for infinite scroll
  const loadMore = useCallback(() => {
    if (enableInfiniteScroll && apiCall.data?.pagination.hasNext) {
      nextPage();
    }
  }, [enableInfiniteScroll, apiCall.data?.pagination.hasNext, nextPage]);

  // Update filters
  const setFilters = useCallback((filters: Record<string, any>) => {
    setAccumulatedData([]); // Clear data when filters change
    setParams(prev => ({ ...prev, filters, page: 1 }));
  }, []);

  // Update sorting
  const setSorting = useCallback((sortBy: string, sortOrder: 'asc' | 'desc' = 'asc') => {
    setAccumulatedData([]); // Clear data when sorting changes
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  }, []);

  // Update page size
  const setPageSize = useCallback((limit: number) => {
    setAccumulatedData([]); // Clear data when page size changes
    setParams(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setAccumulatedData([]);
    setParams({
      page: 1,
      limit: 20,
      ...initialParams
    });
  }, [initialParams]);

  // Refresh current page
  const refresh = useCallback(async () => {
    if (enableInfiniteScroll) {
      // For infinite scroll, reset to first page
      setAccumulatedData([]);
      setParams(prev => ({ ...prev, page: 1 }));
    } else {
      // For regular pagination, refresh current page
      await apiCall.refresh();
    }
  }, [enableInfiniteScroll, apiCall]);

  return {
    // Data
    data: accumulatedData,
    rawData: apiCall.data?.data || [],
    pagination: apiCall.data?.pagination || null,
    
    // State
    loading: apiCall.loading,
    error: apiCall.error,
    isStale: apiCall.isStale,
    
    // Current params
    currentPage: params.page,
    pageSize: params.limit,
    filters: params.filters,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    
    // Navigation
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    loadMore,
    
    // Configuration
    setFilters,
    setSorting,
    setPageSize,
    
    // Actions
    refresh,
    reset,
    clearError: apiCall.clearError,
    
    // Computed
    hasData: accumulatedData.length > 0,
    isEmpty: accumulatedData.length === 0 && !apiCall.loading,
    isFirstPage: params.page === 1,
    isLastPage: !apiCall.data?.pagination.hasNext,
    canLoadMore: enableInfiniteScroll && (apiCall.data?.pagination.hasNext || false),
    totalItems: apiCall.data?.pagination.total || 0,
    totalPages: apiCall.data?.pagination.totalPages || 0,
    
    // For infinite scroll
    isInfiniteScroll: enableInfiniteScroll,
    hasMore: apiCall.data?.pagination.hasNext || false
  };
}