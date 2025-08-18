import { useState, useCallback } from 'react';
import { monitoringApi } from '@/lib/api-extended';

export function useMonitoring() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Health check
  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await monitoringApi.healthCheck();
      if (response.success && response.data) {
        setHealthStatus(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to check health');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get metrics
  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await monitoringApi.getMetrics();
      if (response.success && response.data) {
        setMetrics(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch metrics');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await monitoringApi.getLogs();
      if (response.success && response.data) {
        setLogs(response.data);
        return response.data;
      } else {
        setError(response.message || 'Failed to fetch logs');
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

  // Clear health status
  const clearHealthStatus = useCallback(() => {
    setHealthStatus(null);
  }, []);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    setMetrics(null);
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs(null);
  }, []);

  return {
    // State
    healthStatus,
    metrics,
    logs,
    loading,
    error,
    
    // Actions
    checkHealth,
    fetchMetrics,
    fetchLogs,
    clearError,
    clearHealthStatus,
    clearMetrics,
    clearLogs,
    
    // Computed
    hasHealthStatus: healthStatus !== null,
    hasMetrics: metrics !== null,
    hasLogs: logs !== null,
    isHealthy: healthStatus?.status === 'healthy',
    systemStatus: healthStatus?.status || 'unknown'
  };
} 