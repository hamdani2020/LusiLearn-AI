import { useState, useCallback } from 'react';
import { assessmentApi, AssessmentQuestion, AssessmentSubmission, AssessmentResult } from '@/lib/api-extended';

export function useAssessments() {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [currentResult, setCurrentResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get assessment questions
  const fetchQuestions = useCallback(async (subject: string, count: number = 20) => {
    setLoading(true);
    setError(null);
    try {
      const response = await assessmentApi.getQuestions(subject, count);
      if (response.success && response.data) {
        setQuestions(response.data.questions);
        return response.data.questions;
      } else {
        setError(response.message || 'Failed to fetch questions');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Submit assessment
  const submitAssessment = useCallback(async (data: AssessmentSubmission) => {
    setLoading(true);
    setError(null);
    try {
      const response = await assessmentApi.submit(data);
      if (response.success && response.data) {
        setCurrentResult(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to submit assessment');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get assessment results
  const fetchResults = useCallback(async (assessmentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await assessmentApi.getResults(assessmentId);
      if (response.success && response.data) {
        setCurrentResult(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch results');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze skill gaps
  const analyzeSkillGaps = useCallback(async (targetLevels: Record<string, number>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await assessmentApi.analyzeSkillGaps({ targetLevels });
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to analyze skill gaps');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get learning recommendations
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await assessmentApi.getRecommendations();
      if (response.success && response.data) {
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

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear questions
  const clearQuestions = useCallback(() => {
    setQuestions([]);
  }, []);

  // Clear result
  const clearResult = useCallback(() => {
    setCurrentResult(null);
  }, []);

  return {
    // State
    questions,
    currentResult,
    loading,
    error,
    
    // Actions
    fetchQuestions,
    submitAssessment,
    fetchResults,
    analyzeSkillGaps,
    fetchRecommendations,
    clearError,
    clearQuestions,
    clearResult,
    
    // Computed
    hasQuestions: questions.length > 0,
    hasResult: currentResult !== null,
    questionCount: questions.length,
    score: currentResult?.score || 0,
    totalQuestions: currentResult?.totalQuestions || 0,
    correctAnswers: currentResult?.correctAnswers || 0,
    timeSpent: currentResult?.timeSpent || 0
  };
} 