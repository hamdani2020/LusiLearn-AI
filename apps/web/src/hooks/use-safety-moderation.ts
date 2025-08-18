import { useState, useCallback } from 'react';
import { safetyApi, ContentFilterRequest, ContentFilterResponse, ContentReport, ModerationStatus } from '@/lib/api-extended';

export function useSafetyModeration() {
  const [filterResponse, setFilterResponse] = useState<ContentFilterResponse | null>(null);
  const [moderationStatus, setModerationStatus] = useState<ModerationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter content
  const filterContent = useCallback(async (data: ContentFilterRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await safetyApi.filterContent(data);
      if (response.success && response.data) {
        setFilterResponse(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to filter content');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Report inappropriate content
  const reportContent = useCallback(async (data: ContentReport) => {
    setLoading(true);
    setError(null);
    try {
      const response = await safetyApi.reportContent(data);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to report content');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get moderation status
  const fetchModerationStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await safetyApi.getModerationStatus();
      if (response.success && response.data) {
        setModerationStatus(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch moderation status');
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

  // Clear filter response
  const clearFilterResponse = useCallback(() => {
    setFilterResponse(null);
  }, []);

  // Clear moderation status
  const clearModerationStatus = useCallback(() => {
    setModerationStatus(null);
  }, []);

  return {
    // State
    filterResponse,
    moderationStatus,
    loading,
    error,
    
    // Actions
    filterContent,
    reportContent,
    fetchModerationStatus,
    clearError,
    clearFilterResponse,
    clearModerationStatus,
    
    // Computed
    hasFilterResponse: filterResponse !== null,
    hasModerationStatus: moderationStatus !== null,
    isContentAppropriate: filterResponse?.isAppropriate ?? true,
    filterConfidence: filterResponse?.confidence || 0,
    userStatus: moderationStatus?.status || 'clean',
    warningCount: moderationStatus?.warnings || 0,
    isSuspended: moderationStatus?.status === 'suspended',
    isBanned: moderationStatus?.status === 'banned'
  };
} 