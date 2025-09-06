import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PerformanceMonitor,
  PerformanceDashboard,
  PerformanceAlert,
  createPerformanceMonitor
} from '@/lib/api-client/performance-monitor';
import { MetricsCollector } from '@/lib/api-client/metrics';

export interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  refreshInterval?: number;
  alertCallback?: (alert: PerformanceAlert) => void;
}

export interface UsePerformanceMonitorReturn {
  dashboard: PerformanceDashboard | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  acknowledgeAlert: (alertId: string) => boolean;
  clearAcknowledgedAlerts: () => void;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export function usePerformanceMonitor(
  metricsCollector: MetricsCollector,
  options: UsePerformanceMonitorOptions = {}
): UsePerformanceMonitorReturn {
  const {
    enabled = true,
    refreshInterval = 30000,
    alertCallback
  } = options;

  const [dashboard, setDashboard] = useState<PerformanceDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const monitorRef = useRef<PerformanceMonitor | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const alertCallbackRef = useRef(alertCallback);

  // Update alert callback ref when it changes
  useEffect(() => {
    alertCallbackRef.current = alertCallback;
  }, [alertCallback]);

  // Initialize performance monitor
  useEffect(() => {
    if (!isEnabled || !metricsCollector) {
      return;
    }

    try {
      monitorRef.current = createPerformanceMonitor(metricsCollector);

      // Set up alert callback
      if (alertCallbackRef.current) {
        const unsubscribe = monitorRef.current.onAlert(alertCallbackRef.current);
        return () => {
          unsubscribe();
        };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize performance monitor');
    }

    return () => {
      if (monitorRef.current) {
        monitorRef.current.destroy();
        monitorRef.current = null;
      }
    };
  }, [isEnabled, metricsCollector]);

  // Refresh dashboard data
  const refresh = useCallback(() => {
    if (!monitorRef.current || !isEnabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Analyze current performance
      monitorRef.current.analyzePerformance();
      
      // Get dashboard data
      const dashboardData = monitorRef.current.getDashboard();
      setDashboard(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled]);

  // Set up automatic refresh
  useEffect(() => {
    if (!isEnabled || refreshInterval <= 0) {
      return;
    }

    // Initial refresh
    refresh();

    // Set up interval
    intervalRef.current = setInterval(refresh, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isEnabled, refreshInterval, refresh]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string): boolean => {
    if (!monitorRef.current) {
      return false;
    }

    const success = monitorRef.current.acknowledgeAlert(alertId);
    if (success) {
      // Refresh dashboard to show updated alert status
      refresh();
    }
    return success;
  }, [refresh]);

  // Clear acknowledged alerts
  const clearAcknowledgedAlerts = useCallback(() => {
    if (!monitorRef.current) {
      return;
    }

    monitorRef.current.clearAcknowledgedAlerts();
    refresh();
  }, [refresh]);

  // Handle enabled state changes
  const handleSetEnabled = useCallback((newEnabled: boolean) => {
    setIsEnabled(newEnabled);
    
    if (!newEnabled) {
      // Clear data when disabled
      setDashboard(null);
      setError(null);
      
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, []);

  return {
    dashboard,
    isLoading,
    error,
    refresh,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    isEnabled,
    setEnabled: handleSetEnabled
  };
}

// Hook for getting performance alerts only
export function usePerformanceAlerts(
  metricsCollector: MetricsCollector,
  callback?: (alert: PerformanceAlert) => void
) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const monitorRef = useRef<PerformanceMonitor | null>(null);

  useEffect(() => {
    if (!metricsCollector) {
      return;
    }

    monitorRef.current = createPerformanceMonitor(metricsCollector);

    const unsubscribe = monitorRef.current.onAlert((alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 49)]); // Keep last 50 alerts
      callback?.(alert);
    });

    return () => {
      unsubscribe();
      if (monitorRef.current) {
        monitorRef.current.destroy();
        monitorRef.current = null;
      }
    };
  }, [metricsCollector, callback]);

  const acknowledgeAlert = useCallback((alertId: string): boolean => {
    if (!monitorRef.current) {
      return false;
    }

    const success = monitorRef.current.acknowledgeAlert(alertId);
    if (success) {
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      );
    }
    return success;
  }, []);

  const clearAcknowledgedAlerts = useCallback(() => {
    if (!monitorRef.current) {
      return;
    }

    monitorRef.current.clearAcknowledgedAlerts();
    setAlerts(prev => prev.filter(alert => !alert.acknowledged));
  }, []);

  return {
    alerts,
    acknowledgeAlert,
    clearAcknowledgedAlerts
  };
}

// Hook for getting specific performance metrics
export function usePerformanceMetrics(
  metricsCollector: MetricsCollector,
  refreshInterval = 5000
) {
  const [metrics, setMetrics] = useState({
    responseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    requestsPerMinute: 0,
    totalRequests: 0
  });

  useEffect(() => {
    if (!metricsCollector || refreshInterval <= 0) {
      return;
    }

    const updateMetrics = () => {
      const apiMetrics = metricsCollector.getMetrics();
      setMetrics({
        responseTime: apiMetrics.averageResponseTime,
        errorRate: apiMetrics.totalRequests > 0 
          ? (apiMetrics.failedRequests / apiMetrics.totalRequests) * 100 
          : 0,
        cacheHitRate: apiMetrics.cacheHitRate * 100,
        requestsPerMinute: apiMetrics.requestsPerMinute,
        totalRequests: apiMetrics.totalRequests
      });
    };

    // Initial update
    updateMetrics();

    // Set up interval
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [metricsCollector, refreshInterval]);

  return metrics;
}