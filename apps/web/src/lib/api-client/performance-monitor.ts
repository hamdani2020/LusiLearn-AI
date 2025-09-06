import { ApiMetrics, RequestMetadata } from './types';
import { MetricsCollector } from './metrics';

// Enhanced performance monitoring interfaces
export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    error: number;
  };
  errorRate: {
    warning: number; // percentage
    error: number; // percentage
  };
  cacheHitRate: {
    warning: number; // percentage
  };
  requestsPerMinute: {
    warning: number;
    error: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'performance' | 'errors' | 'cache' | 'throughput';
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  endpoint?: string;
}

export interface PerformanceTrend {
  metric: string;
  values: Array<{
    timestamp: Date;
    value: number;
  }>;
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
}

export interface EndpointPerformance {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  lastRequest: Date;
  trends: {
    responseTime: 'improving' | 'stable' | 'degrading';
    errorRate: 'improving' | 'stable' | 'degrading';
  };
}

export interface PerformanceDashboard {
  summary: {
    uptime: number;
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    requestsPerMinute: number;
    cacheHitRate: number;
    activeAlerts: number;
  };
  trends: PerformanceTrend[];
  alerts: PerformanceAlert[];
  endpoints: EndpointPerformance[];
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    factors: Array<{
      name: string;
      score: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  };
}

export class PerformanceMonitor {
  private metricsCollector: MetricsCollector;
  private alerts: PerformanceAlert[] = [];
  private trends: Map<string, PerformanceTrend> = new Map();
  private endpointMetrics: Map<string, EndpointPerformance> = new Map();
  private thresholds: PerformanceThresholds;
  private alertCallbacks: Array<(alert: PerformanceAlert) => void> = [];
  private trendUpdateInterval: NodeJS.Timeout | null = null;
  private readonly maxAlerts = 100;
  private readonly maxTrendPoints = 100;

  constructor(
    metricsCollector: MetricsCollector,
    thresholds: Partial<PerformanceThresholds> = {}
  ) {
    this.metricsCollector = metricsCollector;
    this.thresholds = {
      responseTime: {
        warning: 2000,
        error: 5000
      },
      errorRate: {
        warning: 5,
        error: 10
      },
      cacheHitRate: {
        warning: 30
      },
      requestsPerMinute: {
        warning: 100,
        error: 200
      },
      ...thresholds
    };

    // Start trend monitoring
    this.startTrendMonitoring();
  }

  // Alert management
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  private createAlert(
    type: PerformanceAlert['type'],
    category: PerformanceAlert['category'],
    title: string,
    message: string,
    metric: string,
    currentValue: number,
    threshold: number,
    endpoint?: string
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category,
      title,
      message,
      metric,
      currentValue,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
      endpoint
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });

    return alert;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  clearAcknowledgedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.acknowledged);
  }

  // Performance analysis
  analyzePerformance(): void {
    const metrics = this.metricsCollector.getMetrics();
    const history = this.metricsCollector.getRequestHistory(1000);

    // Analyze overall performance
    this.analyzeResponseTimes(metrics);
    this.analyzeErrorRates(metrics);
    this.analyzeCachePerformance(metrics);
    this.analyzeThroughput(metrics);

    // Analyze endpoint-specific performance
    this.analyzeEndpointPerformance(history);

    // Update trends
    this.updateTrends(metrics);
  }

  private analyzeResponseTimes(metrics: ApiMetrics): void {
    const avgResponseTime = metrics.averageResponseTime;

    if (avgResponseTime > this.thresholds.responseTime.error) {
      this.createAlert(
        'error',
        'performance',
        'Critical Response Time',
        `Average response time is ${avgResponseTime.toFixed(0)}ms, exceeding critical threshold`,
        'averageResponseTime',
        avgResponseTime,
        this.thresholds.responseTime.error
      );
    } else if (avgResponseTime > this.thresholds.responseTime.warning) {
      this.createAlert(
        'warning',
        'performance',
        'Slow Response Time',
        `Average response time is ${avgResponseTime.toFixed(0)}ms, exceeding warning threshold`,
        'averageResponseTime',
        avgResponseTime,
        this.thresholds.responseTime.warning
      );
    }
  }

  private analyzeErrorRates(metrics: ApiMetrics): void {
    const errorRate = metrics.totalRequests > 0 
      ? (metrics.failedRequests / metrics.totalRequests) * 100 
      : 0;

    if (errorRate > this.thresholds.errorRate.error) {
      this.createAlert(
        'error',
        'errors',
        'High Error Rate',
        `Error rate is ${errorRate.toFixed(1)}%, exceeding critical threshold`,
        'errorRate',
        errorRate,
        this.thresholds.errorRate.error
      );
    } else if (errorRate > this.thresholds.errorRate.warning) {
      this.createAlert(
        'warning',
        'errors',
        'Elevated Error Rate',
        `Error rate is ${errorRate.toFixed(1)}%, exceeding warning threshold`,
        'errorRate',
        errorRate,
        this.thresholds.errorRate.warning
      );
    }
  }

  private analyzeCachePerformance(metrics: ApiMetrics): void {
    const cacheHitRate = metrics.cacheHitRate * 100;

    if (cacheHitRate < this.thresholds.cacheHitRate.warning && metrics.totalRequests > 10) {
      this.createAlert(
        'warning',
        'cache',
        'Low Cache Hit Rate',
        `Cache hit rate is ${cacheHitRate.toFixed(1)}%, below optimal threshold`,
        'cacheHitRate',
        cacheHitRate,
        this.thresholds.cacheHitRate.warning
      );
    }
  }

  private analyzeThroughput(metrics: ApiMetrics): void {
    const requestsPerMinute = metrics.requestsPerMinute;

    if (requestsPerMinute > this.thresholds.requestsPerMinute.error) {
      this.createAlert(
        'error',
        'throughput',
        'Very High Request Volume',
        `Request rate is ${requestsPerMinute} requests/minute, exceeding critical threshold`,
        'requestsPerMinute',
        requestsPerMinute,
        this.thresholds.requestsPerMinute.error
      );
    } else if (requestsPerMinute > this.thresholds.requestsPerMinute.warning) {
      this.createAlert(
        'warning',
        'throughput',
        'High Request Volume',
        `Request rate is ${requestsPerMinute} requests/minute, exceeding warning threshold`,
        'requestsPerMinute',
        requestsPerMinute,
        this.thresholds.requestsPerMinute.warning
      );
    }
  }

  private analyzeEndpointPerformance(history: RequestMetadata[]): void {
    const endpointGroups = new Map<string, RequestMetadata[]>();

    // Group requests by endpoint and method
    for (const request of history) {
      const key = `${request.method} ${request.endpoint}`;
      if (!endpointGroups.has(key)) {
        endpointGroups.set(key, []);
      }
      endpointGroups.get(key)!.push(request);
    }

    // Analyze each endpoint
    for (const [key, requests] of endpointGroups) {
      const [method, endpoint] = key.split(' ', 2);
      const performance = this.calculateEndpointPerformance(endpoint, method, requests);
      this.endpointMetrics.set(key, performance);

      // Check for endpoint-specific issues
      this.checkEndpointAlerts(performance);
    }
  }

  private calculateEndpointPerformance(
    endpoint: string,
    method: string,
    requests: RequestMetadata[]
  ): EndpointPerformance {
    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => 
      r.status && r.status >= 200 && r.status < 400
    ).length;
    const failedRequests = totalRequests - successfulRequests;

    const responseTimes = requests
      .filter(r => r.duration !== undefined)
      .map(r => r.duration!)
      .sort((a, b) => a - b);

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;

    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    const cachedRequests = requests.filter(r => r.cached).length;
    const cacheHitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;

    const lastRequest = requests.length > 0 
      ? new Date(Math.max(...requests.map(r => r.timestamp.getTime())))
      : new Date();

    // Calculate trends (simplified)
    const recentRequests = requests.slice(0, Math.floor(requests.length / 2));
    const olderRequests = requests.slice(Math.floor(requests.length / 2));

    const recentAvgTime = this.calculateAverageResponseTime(recentRequests);
    const olderAvgTime = this.calculateAverageResponseTime(olderRequests);
    const recentErrorRate = this.calculateErrorRate(recentRequests);
    const olderErrorRate = this.calculateErrorRate(olderRequests);

    const responseTimeTrend = this.calculateTrend(recentAvgTime, olderAvgTime);
    const errorRateTrend = this.calculateTrend(recentErrorRate, olderErrorRate, true);

    return {
      endpoint,
      method,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      cacheHitRate,
      lastRequest,
      trends: {
        responseTime: responseTimeTrend,
        errorRate: errorRateTrend
      }
    };
  }

  private calculateAverageResponseTime(requests: RequestMetadata[]): number {
    const times = requests.filter(r => r.duration !== undefined).map(r => r.duration!);
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  }

  private calculateErrorRate(requests: RequestMetadata[]): number {
    if (requests.length === 0) return 0;
    const errors = requests.filter(r => r.error || (r.status && r.status >= 400)).length;
    return (errors / requests.length) * 100;
  }

  private calculateTrend(recent: number, older: number, lowerIsBetter = false): 'improving' | 'stable' | 'degrading' {
    if (older === 0) return 'stable';
    
    const changePercentage = ((recent - older) / older) * 100;
    const threshold = 10; // 10% change threshold

    if (Math.abs(changePercentage) < threshold) {
      return 'stable';
    }

    if (lowerIsBetter) {
      return changePercentage < 0 ? 'improving' : 'degrading';
    } else {
      return changePercentage > 0 ? 'improving' : 'degrading';
    }
  }

  private checkEndpointAlerts(performance: EndpointPerformance): void {
    const endpointKey = `${performance.method} ${performance.endpoint}`;

    // Check response time
    if (performance.averageResponseTime > this.thresholds.responseTime.error) {
      this.createAlert(
        'error',
        'performance',
        'Slow Endpoint',
        `${endpointKey} has average response time of ${performance.averageResponseTime.toFixed(0)}ms`,
        'endpointResponseTime',
        performance.averageResponseTime,
        this.thresholds.responseTime.error,
        performance.endpoint
      );
    }

    // Check error rate
    if (performance.errorRate > this.thresholds.errorRate.error) {
      this.createAlert(
        'error',
        'errors',
        'Failing Endpoint',
        `${endpointKey} has error rate of ${performance.errorRate.toFixed(1)}%`,
        'endpointErrorRate',
        performance.errorRate,
        this.thresholds.errorRate.error,
        performance.endpoint
      );
    }
  }

  private updateTrends(metrics: ApiMetrics): void {
    const now = new Date();
    const metricsToTrack = [
      { key: 'responseTime', value: metrics.averageResponseTime },
      { key: 'errorRate', value: (metrics.failedRequests / Math.max(metrics.totalRequests, 1)) * 100 },
      { key: 'cacheHitRate', value: metrics.cacheHitRate * 100 },
      { key: 'requestsPerMinute', value: metrics.requestsPerMinute }
    ];

    for (const metric of metricsToTrack) {
      let trend = this.trends.get(metric.key);
      
      if (!trend) {
        trend = {
          metric: metric.key,
          values: [],
          trend: 'stable',
          changePercentage: 0
        };
        this.trends.set(metric.key, trend);
      }

      // Add new data point
      trend.values.unshift({
        timestamp: now,
        value: metric.value
      });

      // Keep only recent data points
      if (trend.values.length > this.maxTrendPoints) {
        trend.values = trend.values.slice(0, this.maxTrendPoints);
      }

      // Calculate trend
      if (trend.values.length >= 2) {
        const recent = trend.values.slice(0, Math.floor(trend.values.length / 3));
        const older = trend.values.slice(-Math.floor(trend.values.length / 3));

        const recentAvg = recent.reduce((sum, point) => sum + point.value, 0) / recent.length;
        const olderAvg = older.reduce((sum, point) => sum + point.value, 0) / older.length;

        if (olderAvg !== 0) {
          trend.changePercentage = ((recentAvg - olderAvg) / olderAvg) * 100;
          
          if (Math.abs(trend.changePercentage) < 5) {
            trend.trend = 'stable';
          } else if (metric.key === 'errorRate') {
            trend.trend = trend.changePercentage < 0 ? 'improving' : 'degrading';
          } else if (metric.key === 'responseTime') {
            trend.trend = trend.changePercentage < 0 ? 'improving' : 'degrading';
          } else {
            trend.trend = trend.changePercentage > 0 ? 'improving' : 'degrading';
          }
        }
      }
    }
  }

  private startTrendMonitoring(): void {
    // Update trends every 30 seconds
    this.trendUpdateInterval = setInterval(() => {
      this.analyzePerformance();
    }, 30000);
  }

  // Dashboard generation
  getDashboard(): PerformanceDashboard {
    const metrics = this.metricsCollector.getMetrics();
    const performanceReport = this.metricsCollector.getPerformanceReport();

    // Calculate system health score
    const healthScore = this.calculateSystemHealthScore(metrics);

    return {
      summary: {
        uptime: performanceReport.summary.uptime,
        totalRequests: metrics.totalRequests,
        successRate: performanceReport.summary.successRate,
        averageResponseTime: metrics.averageResponseTime,
        requestsPerMinute: metrics.requestsPerMinute,
        cacheHitRate: metrics.cacheHitRate * 100,
        activeAlerts: this.alerts.filter(a => !a.acknowledged).length
      },
      trends: Array.from(this.trends.values()),
      alerts: this.alerts.slice(0, 20), // Most recent 20 alerts
      endpoints: Array.from(this.endpointMetrics.values())
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 20), // Top 20 endpoints by request count
      systemHealth: healthScore
    };
  }

  private calculateSystemHealthScore(metrics: ApiMetrics): PerformanceDashboard['systemHealth'] {
    const factors = [];
    let totalScore = 0;
    let totalWeight = 0;

    // Response time factor (weight: 30)
    const responseTimeScore = Math.max(0, 100 - (metrics.averageResponseTime / 50));
    factors.push({
      name: 'Response Time',
      score: Math.round(responseTimeScore),
      impact: 'high' as const
    });
    totalScore += responseTimeScore * 30;
    totalWeight += 30;

    // Error rate factor (weight: 40)
    const errorRate = metrics.totalRequests > 0 ? (metrics.failedRequests / metrics.totalRequests) * 100 : 0;
    const errorScore = Math.max(0, 100 - (errorRate * 10));
    factors.push({
      name: 'Error Rate',
      score: Math.round(errorScore),
      impact: 'high' as const
    });
    totalScore += errorScore * 40;
    totalWeight += 40;

    // Cache efficiency factor (weight: 20)
    const cacheScore = metrics.cacheHitRate * 100;
    factors.push({
      name: 'Cache Efficiency',
      score: Math.round(cacheScore),
      impact: 'medium' as const
    });
    totalScore += cacheScore * 20;
    totalWeight += 20;

    // Alert factor (weight: 10)
    const activeAlerts = this.alerts.filter(a => !a.acknowledged && a.type === 'error').length;
    const alertScore = Math.max(0, 100 - (activeAlerts * 20));
    factors.push({
      name: 'System Alerts',
      score: Math.round(alertScore),
      impact: 'low' as const
    });
    totalScore += alertScore * 10;
    totalWeight += 10;

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    let status: 'healthy' | 'warning' | 'critical';
    if (overallScore >= 80) {
      status = 'healthy';
    } else if (overallScore >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      status,
      score: Math.round(overallScore),
      factors
    };
  }

  // Cleanup
  destroy(): void {
    if (this.trendUpdateInterval) {
      clearInterval(this.trendUpdateInterval);
      this.trendUpdateInterval = null;
    }
    this.alertCallbacks = [];
    this.alerts = [];
    this.trends.clear();
    this.endpointMetrics.clear();
  }

  // Configuration
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }
}

// Factory function
export function createPerformanceMonitor(
  metricsCollector: MetricsCollector,
  thresholds?: Partial<PerformanceThresholds>
): PerformanceMonitor {
  return new PerformanceMonitor(metricsCollector, thresholds);
}