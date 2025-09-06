import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  PerformanceMonitor,
  createPerformanceMonitor,
  PerformanceAlert
} from '../performance-monitor';
import { MetricsCollector } from '../metrics';
import { RequestMetadata } from '../types';

// Mock timers
jest.useFakeTimers();

describe('PerformanceMonitor', () => {
  let metricsCollector: MetricsCollector;
  let performanceMonitor: PerformanceMonitor;
  let alertCallback: jest.MockedFunction<any>;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    performanceMonitor = createPerformanceMonitor(metricsCollector);
    alertCallback = jest.fn();
  });

  afterEach(() => {
    performanceMonitor.destroy();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Alert Generation', () => {
    it('should generate error alert for high response times', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Simulate slow requests
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 6000, // 6 seconds - above error threshold
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          category: 'performance',
          title: 'Critical Response Time',
          metric: 'averageResponseTime'
        })
      );

      unsubscribe();
    });

    it('should generate warning alert for elevated error rates', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Simulate requests with errors
      for (let i = 0; i < 20; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 1000,
          status: i < 2 ? 500 : 200, // 10% error rate
          retryCount: 0,
          cached: false,
          error: i < 2 ? 'Server error' : undefined
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          category: 'errors',
          title: 'Elevated Error Rate',
          metric: 'errorRate'
        })
      );

      unsubscribe();
    });

    it('should generate cache performance alert for low hit rates', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Simulate requests with low cache hit rate
      for (let i = 0; i < 20; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 1000,
          status: 200,
          retryCount: 0,
          cached: i < 2 // Only 10% cached
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          category: 'cache',
          title: 'Low Cache Hit Rate',
          metric: 'cacheHitRate'
        })
      );

      unsubscribe();
    });

    it('should generate throughput alert for high request volume', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Create monitor with low throughput thresholds for testing
      const testMonitor = createPerformanceMonitor(metricsCollector, {
        requestsPerMinute: { warning: 5, error: 10 }
      });

      // Simulate high request volume
      const now = new Date();
      for (let i = 0; i < 15; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(now.getTime() - (i * 1000)), // Spread over last 15 seconds
          duration: 1000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      testMonitor.onAlert(alertCallback);
      testMonitor.analyzePerformance();

      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          category: 'throughput',
          title: 'Very High Request Volume',
          metric: 'requestsPerMinute'
        })
      );

      testMonitor.destroy();
      unsubscribe();
    });
  });

  describe('Endpoint Performance Analysis', () => {
    it('should analyze individual endpoint performance', () => {
      // Simulate requests to different endpoints
      const endpoints = ['/api/users', '/api/posts', '/api/comments'];
      
      endpoints.forEach((endpoint, endpointIndex) => {
        for (let i = 0; i < 10; i++) {
          const metadata: RequestMetadata = {
            id: `req-${endpointIndex}-${i}`,
            endpoint,
            method: 'GET',
            timestamp: new Date(),
            duration: (endpointIndex + 1) * 1000, // Different response times per endpoint
            status: i < 8 ? 200 : 500, // 20% error rate
            retryCount: 0,
            cached: i % 2 === 0 // 50% cache hit rate
          };
          metricsCollector.recordRequest(metadata);
        }
      });

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      expect(dashboard.endpoints).toHaveLength(3);
      
      const usersEndpoint = dashboard.endpoints.find(e => e.endpoint === '/api/users');
      expect(usersEndpoint).toBeDefined();
      expect(usersEndpoint!.totalRequests).toBe(10);
      expect(usersEndpoint!.averageResponseTime).toBe(1000);
      expect(usersEndpoint!.errorRate).toBe(20);
      expect(usersEndpoint!.cacheHitRate).toBe(50);
    });

    it('should calculate percentile response times correctly', () => {
      // Create requests with known response times
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      responseTimes.forEach((duration, i) => {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      });

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      const endpoint = dashboard.endpoints.find(e => e.endpoint === '/api/test');
      expect(endpoint).toBeDefined();
      expect(endpoint!.averageResponseTime).toBe(550); // Average of 100-1000
      expect(endpoint!.p95ResponseTime).toBe(900); // 95th percentile
      expect(endpoint!.p99ResponseTime).toBe(1000); // 99th percentile
    });

    it('should detect endpoint performance trends', () => {
      // Simulate improving performance over time
      for (let i = 0; i < 20; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: i < 10 ? 2000 : 1000, // Response time improves in second half
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      const endpoint = dashboard.endpoints.find(e => e.endpoint === '/api/test');
      expect(endpoint).toBeDefined();
      expect(endpoint!.trends.responseTime).toBe('improving');
    });
  });

  describe('System Health Calculation', () => {
    it('should calculate system health score correctly', () => {
      // Simulate good performance
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 500, // Good response time
          status: 200, // No errors
          retryCount: 0,
          cached: i % 2 === 0 // 50% cache hit rate
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      expect(dashboard.systemHealth.status).toBe('healthy');
      expect(dashboard.systemHealth.score).toBeGreaterThan(80);
      expect(dashboard.systemHealth.factors).toHaveLength(4);
    });

    it('should detect critical system health issues', () => {
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 8000, // Very slow
          status: i < 5 ? 500 : 200, // 50% error rate
          retryCount: 0,
          cached: false, // No caching
          error: i < 5 ? 'Server error' : undefined
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      expect(dashboard.systemHealth.status).toBe('critical');
      expect(dashboard.systemHealth.score).toBeLessThan(60);
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alerts correctly', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Generate an alert
      for (let i = 0; i < 5; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 6000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      
      const dashboard = performanceMonitor.getDashboard();
      const alert = dashboard.alerts[0];
      
      expect(alert.acknowledged).toBe(false);

      const success = performanceMonitor.acknowledgeAlert(alert.id);
      expect(success).toBe(true);

      const updatedDashboard = performanceMonitor.getDashboard();
      const updatedAlert = updatedDashboard.alerts.find(a => a.id === alert.id);
      expect(updatedAlert?.acknowledged).toBe(true);

      unsubscribe();
    });

    it('should clear acknowledged alerts', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);

      // Generate multiple alerts
      for (let i = 0; i < 5; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 6000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      
      let dashboard = performanceMonitor.getDashboard();
      const alertIds = dashboard.alerts.map(a => a.id);

      // Acknowledge some alerts
      alertIds.slice(0, 2).forEach(id => {
        performanceMonitor.acknowledgeAlert(id);
      });

      // Clear acknowledged alerts
      performanceMonitor.clearAcknowledgedAlerts();

      dashboard = performanceMonitor.getDashboard();
      expect(dashboard.alerts.every(a => !a.acknowledged)).toBe(true);

      unsubscribe();
    });
  });

  describe('Trend Analysis', () => {
    it('should track performance trends over time', () => {
      // Simulate trend monitoring
      jest.advanceTimersByTime(30000); // Advance 30 seconds to trigger trend update

      // Add some metrics
      for (let i = 0; i < 5; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 1000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      expect(dashboard.trends.length).toBeGreaterThan(0);
      
      const responseTimeTrend = dashboard.trends.find(t => t.metric === 'responseTime');
      expect(responseTimeTrend).toBeDefined();
      expect(responseTimeTrend!.values.length).toBeGreaterThan(0);
    });

    it('should detect improving trends', () => {
      // First batch - slower responses
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-old-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(Date.now() - 60000), // 1 minute ago
          duration: 2000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      // Second batch - faster responses
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-new-${i}`,
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          duration: 1000,
          status: 200,
          retryCount: 0,
          cached: false
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      const responseTimeTrend = dashboard.trends.find(t => t.metric === 'responseTime');
      expect(responseTimeTrend?.trend).toBe('improving');
      expect(responseTimeTrend?.changePercentage).toBeLessThan(0);
    });
  });

  describe('Configuration and Cleanup', () => {
    it('should update thresholds correctly', () => {
      const newThresholds = {
        responseTime: { warning: 1000, error: 3000 },
        errorRate: { warning: 2, error: 5 }
      };

      performanceMonitor.updateThresholds(newThresholds);
      const thresholds = performanceMonitor.getThresholds();

      expect(thresholds.responseTime.warning).toBe(1000);
      expect(thresholds.responseTime.error).toBe(3000);
      expect(thresholds.errorRate.warning).toBe(2);
      expect(thresholds.errorRate.error).toBe(5);
    });

    it('should clean up resources on destroy', () => {
      const unsubscribe = performanceMonitor.onAlert(alertCallback);
      
      performanceMonitor.destroy();

      // Should not crash when calling methods after destroy
      expect(() => {
        performanceMonitor.analyzePerformance();
        performanceMonitor.getDashboard();
      }).not.toThrow();

      unsubscribe();
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate comprehensive dashboard data', () => {
      // Add some test data
      for (let i = 0; i < 10; i++) {
        const metadata: RequestMetadata = {
          id: `req-${i}`,
          endpoint: `/api/endpoint-${i % 3}`,
          method: 'GET',
          timestamp: new Date(),
          duration: 1000 + (i * 100),
          status: i < 8 ? 200 : 500,
          retryCount: 0,
          cached: i % 2 === 0
        };
        metricsCollector.recordRequest(metadata);
      }

      performanceMonitor.analyzePerformance();
      const dashboard = performanceMonitor.getDashboard();

      // Check all dashboard sections are present
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.endpoints).toBeDefined();
      expect(dashboard.systemHealth).toBeDefined();

      // Check summary data
      expect(dashboard.summary.totalRequests).toBe(10);
      expect(dashboard.summary.successRate).toBe(80);
      expect(dashboard.summary.cacheHitRate).toBe(50);

      // Check endpoints data
      expect(dashboard.endpoints.length).toBeGreaterThan(0);
      expect(dashboard.endpoints[0]).toHaveProperty('endpoint');
      expect(dashboard.endpoints[0]).toHaveProperty('totalRequests');
      expect(dashboard.endpoints[0]).toHaveProperty('averageResponseTime');
    });
  });
});