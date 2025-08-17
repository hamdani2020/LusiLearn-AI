import { useState, useCallback } from 'react';
import { progressApi, ProgressUpdate, LearningAnalytics, ProgressVisualization } from '@/lib/api-extended';

export function useProgressTracking() {
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null);
  const [visualization, setVisualization] = useState<ProgressVisualization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update progress
  const updateProgress = useCallback(async (data: ProgressUpdate) => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.updateProgress(data);
      if (response.success) {
        return response.data;
      } else {
        setError(response.message || 'Failed to update progress');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get learning analytics
  const fetchAnalytics = useCallback(async (timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.getAnalytics(timeframe);
      if (response.success && response.data) {
        setAnalytics(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch analytics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get progress visualization
  const fetchVisualization = useCallback(async (pathId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.getVisualization(pathId);
      if (response.success && response.data) {
        setVisualization(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch visualization');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get session details
  const fetchSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.getSession(sessionId);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch session');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get learning streaks
  const fetchStreaks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.getStreaks();
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch streaks');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get learning goals
  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await progressApi.getGoals();
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch goals');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
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
    analytics,
    visualization,
    loading,
    error,
    
    // Actions
    updateProgress,
    fetchAnalytics,
    fetchVisualization,
    fetchSession,
    fetchStreaks,
    fetchGoals,
    clearError,
    
    // Computed
    hasAnalytics: analytics !== null,
    hasVisualization: visualization !== null,
    currentStreak: analytics?.currentStreak || 0,
    longestStreak: analytics?.longestStreak || 0,
    totalTimeSpent: analytics?.totalTimeSpent || 0,
    averageScore: analytics?.averageScore || 0
  };
} 