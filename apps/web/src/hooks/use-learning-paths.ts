import { useState, useCallback } from 'react';
import { learningPathApi, LearningPath, CreateLearningPathRequest, UpdateLearningPathRequest } from '@/lib/api-extended';

export function useLearningPaths() {
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [currentPath, setCurrentPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get all learning paths
  const fetchLearningPaths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.getAll();
      if (response.success && response.data) {
        setLearningPaths(response.data);
      } else {
        setError(response.message || 'Failed to fetch learning paths');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Get a specific learning path
  const fetchLearningPath = useCallback(async (pathId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.getById(pathId);
      if (response.success && response.data) {
        setCurrentPath(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch learning path');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new learning path
  const createLearningPath = useCallback(async (data: CreateLearningPathRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.create(data);
      if (response.success && response.data) {
        setLearningPaths(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.message || 'Failed to create learning path');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a learning path
  const updateLearningPath = useCallback(async (pathId: string, data: UpdateLearningPathRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.update(pathId, data);
      if (response.success && response.data) {
        setLearningPaths(prev => 
          prev.map(path => path.id === pathId ? response.data! : path)
        );
        if (currentPath?.id === pathId) {
          setCurrentPath(response.data);
        }
        return response.data;
      } else {
        setError(response.message || 'Failed to update learning path');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Delete a learning path
  const deleteLearningPath = useCallback(async (pathId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.delete(pathId);
      if (response.success) {
        setLearningPaths(prev => prev.filter(path => path.id !== pathId));
        if (currentPath?.id === pathId) {
          setCurrentPath(null);
        }
        return true;
      } else {
        setError(response.message || 'Failed to delete learning path');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  // Share a learning path
  const shareLearningPath = useCallback(async (pathId: string, sharedWithUserId: string, permissions: 'view' | 'collaborate', message?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await learningPathApi.share(pathId, {
        sharedWithUserId,
        permissions,
        message
      });
      if (response.success) {
        return true;
      } else {
        setError(response.message || 'Failed to share learning path');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    learningPaths,
    currentPath,
    loading,
    error,
    
    // Actions
    fetchLearningPaths,
    fetchLearningPath,
    createLearningPath,
    updateLearningPath,
    deleteLearningPath,
    shareLearningPath,
    clearError,
    
    // Computed
    hasLearningPaths: learningPaths.length > 0,
    currentPathId: currentPath?.id
  };
} 