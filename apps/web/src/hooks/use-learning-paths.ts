import { useState, useCallback, useEffect } from 'react';
import { 
  learningPathApi, 
  LearningPath, 
  CreateLearningPathRequest, 
  UpdateLearningPathRequest,
  ShareLearningPathRequest 
} from '@/lib/api-extended';
import { 
  useBaseHook, 
  useCrudOperations,
  useApiCall,
  globalStateRegistry,
  BaseHookState,
  BaseHookActions
} from './base';

// Enhanced Learning Paths Hook Interface
export interface UseLearningPathsReturn extends BaseHookState<LearningPath[]>, BaseHookActions {
  // Data
  learningPaths: LearningPath[];
  currentPath: LearningPath | null;
  
  // Computed
  hasLearningPaths: boolean;
  totalPaths: number;
  completedPaths: number;
  activePaths: number;
  currentPathId?: string;
  
  // Actions
  fetchLearningPaths: () => Promise<LearningPath[] | null>;
  fetchLearningPath: (id: string) => Promise<LearningPath | null>;
  createLearningPath: (data: CreateLearningPathRequest) => Promise<LearningPath | null>;
  updateLearningPath: (id: string, data: UpdateLearningPathRequest) => Promise<LearningPath | null>;
  deleteLearningPath: (id: string) => Promise<boolean>;
  shareLearningPath: (id: string, shareData: ShareLearningPathRequest) => Promise<boolean>;
  setCurrentPath: (path: LearningPath | null) => void;
  
  // Optimistic updates
  optimisticUpdate: (id: string, data: Partial<LearningPath>) => void;
  rollbackOptimisticUpdate: (id: string) => void;
  confirmOptimisticUpdate: (id: string) => void;
  getPendingUpdates: () => any[];
  
  // State synchronization
  syncWithGlobalState: () => void;
  subscribeToGlobalChanges: (callback: (paths: LearningPath[]) => void) => () => void;
}

export function useLearningPaths(): UseLearningPathsReturn {
  // Current path state (separate from the list)
  const [currentPath, setCurrentPath] = useState<LearningPath | null>(null);

  // CRUD operations for learning paths
  const crudOps = useCrudOperations<LearningPath, CreateLearningPathRequest, UpdateLearningPathRequest>({
    endpoints: {
      getAll: '/api/v1/learning-paths',
      getById: '/api/v1/learning-paths/:id',
      create: '/api/v1/learning-paths',
      update: '/api/v1/learning-paths/:id',
      delete: '/api/v1/learning-paths/:id'
    },
    cacheKey: 'learning-paths',
    enableOptimisticUpdates: true,
    autoFetch: true,
    cacheTime: 10 * 60 * 1000, // 10 minutes
    staleTime: 2 * 60 * 1000,   // 2 minutes
    onSuccess: (data) => {
      // Sync with global state when data changes
      if (Array.isArray(data)) {
        globalStateRegistry.getState<LearningPath[]>('learning-paths').set(data);
      }
    }
  });

  // Individual path fetching
  const pathFetchCall = useApiCall<LearningPath>({
    endpoint: '/api/v1/learning-paths/:id',
    method: 'GET',
    autoFetch: false,
    cacheTime: 5 * 60 * 1000,
    onSuccess: (path) => {
      setCurrentPath(path);
      // Update the path in the main list if it exists
      if (crudOps.data) {
        const updatedPaths = crudOps.data.map(p => p.id === path.id ? path : p);
        globalStateRegistry.getState<LearningPath[]>('learning-paths').set(updatedPaths);
      }
    }
  });

  // Sharing functionality
  const shareCall = useApiCall<any>({
    endpoint: '/api/v1/learning-paths/:id/share',
    method: 'POST',
    autoFetch: false
  });

  // Fetch all learning paths
  const fetchLearningPaths = useCallback(async (): Promise<LearningPath[] | null> => {
    return await crudOps.fetchAll();
  }, [crudOps]);

  // Fetch specific learning path
  const fetchLearningPath = useCallback(async (id: string): Promise<LearningPath | null> => {
    const endpoint = pathFetchCall.endpoint?.replace(':id', id) || '';
    // Update the endpoint for this specific call
    const result = await pathFetchCall.execute();
    return result;
  }, [pathFetchCall]);

  // Create learning path with optimistic update
  const createLearningPath = useCallback(async (data: CreateLearningPathRequest): Promise<LearningPath | null> => {
    return await crudOps.create(data);
  }, [crudOps]);

  // Update learning path with optimistic update
  const updateLearningPath = useCallback(async (id: string, data: UpdateLearningPathRequest): Promise<LearningPath | null> => {
    const result = await crudOps.update(id, data);
    
    // Update current path if it's the one being updated
    if (currentPath?.id === id && result) {
      setCurrentPath(result);
    }
    
    return result;
  }, [crudOps, currentPath]);

  // Delete learning path with optimistic update
  const deleteLearningPath = useCallback(async (id: string): Promise<boolean> => {
    const result = await crudOps.delete(id);
    
    // Clear current path if it's the one being deleted
    if (currentPath?.id === id && result) {
      setCurrentPath(null);
    }
    
    return result;
  }, [crudOps, currentPath]);

  // Share learning path
  const shareLearningPath = useCallback(async (id: string, shareData: ShareLearningPathRequest): Promise<boolean> => {
    const endpoint = shareCall.endpoint?.replace(':id', id) || '';
    const result = await shareCall.execute(shareData);
    return !!result;
  }, [shareCall]);

  // Set current path
  const setCurrentPathHandler = useCallback((path: LearningPath | null) => {
    setCurrentPath(path);
  }, []);

  // Optimistic update methods
  const optimisticUpdate = useCallback((id: string, data: Partial<LearningPath>) => {
    if (crudOps.applyOptimisticUpdate) {
      crudOps.applyOptimisticUpdate(id, data);
    }
    
    // Update current path if it matches
    if (currentPath?.id === id) {
      setCurrentPath({ ...currentPath, ...data });
    }
  }, [crudOps, currentPath]);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    if (crudOps.rollbackOptimisticUpdate) {
      crudOps.rollbackOptimisticUpdate(id);
    }
    
    // Refresh current path if it matches
    if (currentPath?.id === id) {
      fetchLearningPath(id);
    }
  }, [crudOps, currentPath, fetchLearningPath]);

  const confirmOptimisticUpdate = useCallback((id: string) => {
    if (crudOps.confirmOptimisticUpdate) {
      crudOps.confirmOptimisticUpdate(id);
    }
  }, [crudOps]);

  const getPendingUpdates = useCallback(() => {
    return crudOps.getPendingUpdates ? crudOps.getPendingUpdates() : [];
  }, [crudOps]);

  // Global state synchronization
  const syncWithGlobalState = useCallback(() => {
    const globalState = globalStateRegistry.getState<LearningPath[]>('learning-paths');
    const globalData = globalState.get();
    
    if (globalData && globalData !== crudOps.data) {
      // Update local state with global state
      if (crudOps.setData) {
        crudOps.setData(globalData);
      }
    }
  }, [crudOps]);

  const subscribeToGlobalChanges = useCallback((callback: (paths: LearningPath[]) => void) => {
    const globalState = globalStateRegistry.getState<LearningPath[]>('learning-paths');
    return globalState.subscribe((data) => {
      if (data) {
        callback(data);
      }
    });
  }, []);

  // Computed values
  const learningPaths = crudOps.data || [];
  const hasLearningPaths = learningPaths.length > 0;
  const totalPaths = learningPaths.length;
  const completedPaths = learningPaths.filter(path => 
    path.milestones?.every(milestone => milestone.completed)
  ).length;
  const activePaths = totalPaths - completedPaths;

  // Subscribe to global state changes on mount
  useEffect(() => {
    const unsubscribe = subscribeToGlobalChanges((paths) => {
      // Update current path if it exists in the updated paths
      if (currentPath) {
        const updatedCurrentPath = paths.find(p => p.id === currentPath.id);
        if (updatedCurrentPath && updatedCurrentPath !== currentPath) {
          setCurrentPath(updatedCurrentPath);
        }
      }
    });

    return unsubscribe;
  }, [currentPath, subscribeToGlobalChanges]);

  return {
    // Base state
    data: learningPaths,
    loading: crudOps.loading || pathFetchCall.loading || shareCall.loading,
    error: crudOps.error || pathFetchCall.error || shareCall.error,
    lastFetch: null, // Could be enhanced to track last fetch time
    isStale: crudOps.isStale,

    // Data
    learningPaths,
    currentPath,

    // Computed
    hasLearningPaths,
    totalPaths,
    completedPaths,
    activePaths,
    currentPathId: currentPath?.id,

    // Actions
    fetchLearningPaths,
    fetchLearningPath,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath,
    shareLearningPath,
    setCurrentPath: setCurrentPathHandler,
    clearError: crudOps.clearError,
    clearData: crudOps.clearData,
    refresh: crudOps.refresh,
    invalidate: crudOps.invalidate,

    // Optimistic updates
    optimisticUpdate,
    rollbackOptimisticUpdate,
    confirmOptimisticUpdate,
    getPendingUpdates,

    // State synchronization
    syncWithGlobalState,
    subscribeToGlobalChanges
  };
} 