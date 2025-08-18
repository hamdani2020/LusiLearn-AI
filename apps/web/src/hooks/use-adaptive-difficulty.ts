import { useState, useCallback } from 'react';
import { adaptiveDifficultyApi, DifficultyAnalysis, DifficultyRecommendation, DifficultyAdjustment } from '@/lib/api-extended';

export function useAdaptiveDifficulty() {
  const [analysis, setAnalysis] = useState<DifficultyAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<DifficultyRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze user performance
  const analyzePerformance = useCallback(async (subject: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adaptiveDifficultyApi.analyzePerformance(subject);
      if (response.success && response.data) {
        setAnalysis(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to analyze performance');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get difficulty recommendations
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adaptiveDifficultyApi.getRecommendations();
      if (response.success && response.data) {
        setRecommendations(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch recommendations');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Adjust difficulty settings
  const adjustDifficulty = useCallback(async (data: DifficultyAdjustment) => {
    setLoading(true);
    setError(null);
    try {
      const response = await adaptiveDifficultyApi.adjustDifficulty(data);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to adjust difficulty');
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

  // Clear analysis
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  // Clear recommendations
  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  return {
    // State
    analysis,
    recommendations,
    loading,
    error,
    
    // Actions
    analyzePerformance,
    fetchRecommendations,
    adjustDifficulty,
    clearError,
    clearAnalysis,
    clearRecommendations,
    
    // Computed
    hasAnalysis: analysis !== null,
    hasRecommendations: recommendations.length > 0,
    recommendationCount: recommendations.length,
    currentDifficulty: analysis?.currentDifficulty || 0,
    recommendedDifficulty: analysis?.recommendedDifficulty || 0,
    confidence: analysis?.confidence || 0,
    factors: analysis?.factors || []
  };
} 