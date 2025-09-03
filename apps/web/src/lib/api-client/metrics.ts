import { ApiMetrics, RequestMetadata } from './types';

export class MetricsCollector {
  private metrics: ApiMetrics;
  private requestHistory: RequestMetadata[] = [];
  private readonly maxHistorySize = 1000;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): ApiMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorsByType: {},
      slowestEndpoints: [],
      requestsPerMinute: 0,
      lastReset: new Date()
    };
  }

  recordRequest(metadata: RequestMetadata): void {
    // Add to history
    this.requestHistory.unshift(metadata);
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(0, this.maxHistorySize);
    }

    // Update metrics
    this.metrics.totalRequests++;

    if (metadata.status && metadata.status >= 200 && metadata.status < 400) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update response time
    if (metadata.duration) {
      const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + metadata.duration;
      this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
    }

    // Update cache hit rate
    const cachedRequests = this.requestHistory.filter(r => r.cached).length;
    this.metrics.cacheHitRate = cachedRequests / this.requestHistory.length;

    // Update error tracking
    if (metadata.error) {
      const errorType = this.getErrorType(metadata.status);
      this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    }

    // Update slowest endpoints
    this.updateSlowestEndpoints(metadata);

    // Update requests per minute
    this.updateRequestsPerMinute();
  }

  private getErrorType(status?: number): string {
    if (!status) return 'network';
    if (status >= 400 && status < 500) return 'client';
    if (status >= 500) return 'server';
    return 'unknown';
  }

  private updateSlowestEndpoints(metadata: RequestMetadata): void {
    if (!metadata.duration) return;

    const endpoint = metadata.endpoint;
    const existingIndex = this.metrics.slowestEndpoints.findIndex(e => e.endpoint === endpoint);

    if (existingIndex >= 0) {
      const existing = this.metrics.slowestEndpoints[existingIndex];
      const totalTime = existing.averageTime * existing.requestCount + metadata.duration;
      existing.requestCount++;
      existing.averageTime = totalTime / existing.requestCount;
    } else {
      this.metrics.slowestEndpoints.push({
        endpoint,
        averageTime: metadata.duration,
        requestCount: 1
      });
    }

    // Keep only top 10 slowest endpoints
    this.metrics.slowestEndpoints.sort((a, b) => b.averageTime - a.averageTime);
    this.metrics.slowestEndpoints = this.metrics.slowestEndpoints.slice(0, 10);
  }

  private updateRequestsPerMinute(): void {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentRequests = this.requestHistory.filter(r => r.timestamp > oneMinuteAgo);
    this.metrics.requestsPerMinute = recentRequests.length;
  }

  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }

  getRequestHistory(limit?: number): RequestMetadata[] {
    return limit ? this.requestHistory.slice(0, limit) : [...this.requestHistory];
  }

  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.requestHistory = [];
    this.startTime = new Date();
  }

  // Performance analysis methods
  getPerformanceReport(): {
    summary: {
      uptime: number;
      totalRequests: number;
      successRate: number;
      averageResponseTime: number;
      requestsPerMinute: number;
    };
    errors: {
      type: string;
      count: number;
      percentage: number;
    }[];
    slowestEndpoints: {
      endpoint: string;
      averageTime: number;
      requestCount: number;
    }[];
    cacheEfficiency: {
      hitRate: number;
      totalCachedRequests: number;
    };
  } {
    const uptime = Date.now() - this.startTime.getTime();
    const successRate = this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 0;

    const errors = Object.entries(this.metrics.errorsByType).map(([type, count]) => ({
      type,
      count,
      percentage: (count / this.metrics.totalRequests) * 100
    }));

    const cachedRequests = this.requestHistory.filter(r => r.cached).length;

    return {
      summary: {
        uptime,
        totalRequests: this.metrics.totalRequests,
        successRate,
        averageResponseTime: this.metrics.averageResponseTime,
        requestsPerMinute: this.metrics.requestsPerMinute
      },
      errors,
      slowestEndpoints: this.metrics.slowestEndpoints,
      cacheEfficiency: {
        hitRate: this.metrics.cacheHitRate * 100,
        totalCachedRequests: cachedRequests
      }
    };
  }

  // Alert conditions
  getAlerts(): {
    type: 'warning' | 'error';
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }[] {
    const alerts: any[] = [];

    // High error rate
    const errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;
    
    if (errorRate > 10) {
      alerts.push({
        type: 'error',
        message: 'High error rate detected',
        metric: 'errorRate',
        value: errorRate,
        threshold: 10
      });
    } else if (errorRate > 5) {
      alerts.push({
        type: 'warning',
        message: 'Elevated error rate',
        metric: 'errorRate',
        value: errorRate,
        threshold: 5
      });
    }

    // Slow response times
    if (this.metrics.averageResponseTime > 5000) {
      alerts.push({
        type: 'error',
        message: 'Very slow response times',
        metric: 'averageResponseTime',
        value: this.metrics.averageResponseTime,
        threshold: 5000
      });
    } else if (this.metrics.averageResponseTime > 2000) {
      alerts.push({
        type: 'warning',
        message: 'Slow response times',
        metric: 'averageResponseTime',
        value: this.metrics.averageResponseTime,
        threshold: 2000
      });
    }

    // Low cache hit rate
    if (this.metrics.cacheHitRate < 0.3 && this.metrics.totalRequests > 10) {
      alerts.push({
        type: 'warning',
        message: 'Low cache hit rate',
        metric: 'cacheHitRate',
        value: this.metrics.cacheHitRate * 100,
        threshold: 30
      });
    }

    return alerts;
  }
}

// Logger for debugging and monitoring
export class ApiLogger {
  private enabled: boolean = false;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  constructor(enabled: boolean = false, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.enabled = enabled;
    this.logLevel = logLevel;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  debug(message: string, data?: any): void {
    if (this.enabled && this.shouldLog('debug')) {
      console.debug(`[API Client Debug] ${message}`, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.enabled && this.shouldLog('info')) {
      console.info(`[API Client Info] ${message}`, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.enabled && this.shouldLog('warn')) {
      console.warn(`[API Client Warning] ${message}`, data);
    }
  }

  error(message: string, data?: any): void {
    if (this.enabled && this.shouldLog('error')) {
      console.error(`[API Client Error] ${message}`, data);
    }
  }

  logRequest(metadata: RequestMetadata): void {
    if (this.enabled) {
      this.debug(`Request: ${metadata.method} ${metadata.endpoint}`, {
        requestId: metadata.id,
        timestamp: metadata.timestamp,
        cached: metadata.cached
      });
    }
  }

  logResponse(metadata: RequestMetadata): void {
    if (this.enabled) {
      const level = metadata.error ? 'error' : 'debug';
      const message = metadata.error 
        ? `Request failed: ${metadata.method} ${metadata.endpoint}`
        : `Request completed: ${metadata.method} ${metadata.endpoint}`;
      
      this[level](message, {
        requestId: metadata.id,
        status: metadata.status,
        duration: metadata.duration,
        error: metadata.error,
        retryCount: metadata.retryCount
      });
    }
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
}