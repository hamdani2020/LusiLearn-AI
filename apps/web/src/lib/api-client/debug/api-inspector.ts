import { RequestMetadata, ApiMetrics, ApiResponse } from '../types';
import { EnhancedApiError } from '../errors';

export interface ApiInspectorConfig {
  enabled: boolean;
  maxHistorySize: number;
  enableNetworkTab: boolean;
  enablePerformanceTab: boolean;
  enableErrorTab: boolean;
  enableCacheTab: boolean;
}

export interface RequestInspectorData extends RequestMetadata {
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  stackTrace?: string;
  networkInfo?: {
    connectionType?: string;
    downlink?: number;
    effectiveType?: string;
    rtt?: number;
  };
}

export interface PerformanceProfile {
  endpoint: string;
  method: string;
  samples: {
    timestamp: Date;
    duration: number;
    status?: number;
    cacheHit: boolean;
  }[];
  statistics: {
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
    standardDeviation: number;
  };
}

export class ApiInspector {
  private config: ApiInspectorConfig;
  private requestHistory: RequestInspectorData[] = [];
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private errorPatterns: Map<string, { count: number; lastSeen: Date; examples: EnhancedApiError[] }> = new Map();
  private listeners: Set<(event: ApiInspectorEvent) => void> = new Set();

  constructor(config: Partial<ApiInspectorConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      maxHistorySize: 1000,
      enableNetworkTab: true,
      enablePerformanceTab: true,
      enableErrorTab: true,
      enableCacheTab: true,
      ...config
    };

    // Initialize performance observer if available
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializePerformanceObserver();
    }
  }

  // Event system for real-time updates
  addEventListener(listener: (event: ApiInspectorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ApiInspectorEvent): void {
    if (!this.config.enabled) return;
    this.listeners.forEach(listener => listener(event));
  }

  // Request tracking
  recordRequest(
    metadata: RequestMetadata,
    requestData?: {
      headers?: Record<string, string>;
      body?: any;
    },
    responseData?: {
      headers?: Record<string, string>;
      body?: any;
    }
  ): void {
    if (!this.config.enabled) return;

    const inspectorData: RequestInspectorData = {
      ...metadata,
      requestHeaders: requestData?.headers,
      requestBody: requestData?.body,
      responseHeaders: responseData?.headers,
      responseBody: responseData?.body,
      stackTrace: this.captureStackTrace(),
      networkInfo: this.getNetworkInfo()
    };

    // Add to history
    this.requestHistory.unshift(inspectorData);
    if (this.requestHistory.length > this.config.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(0, this.config.maxHistorySize);
    }

    // Update performance profiles
    this.updatePerformanceProfile(inspectorData);

    // Emit event
    this.emit({
      type: 'request-completed',
      data: inspectorData
    });
  }

  recordError(error: EnhancedApiError, metadata: RequestMetadata): void {
    if (!this.config.enabled) return;

    const errorKey = `${error.type}_${error.code || 'unknown'}`;
    const existing = this.errorPatterns.get(errorKey);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
      existing.examples.push(error);
      // Keep only last 5 examples
      if (existing.examples.length > 5) {
        existing.examples = existing.examples.slice(-5);
      }
    } else {
      this.errorPatterns.set(errorKey, {
        count: 1,
        lastSeen: new Date(),
        examples: [error]
      });
    }

    this.emit({
      type: 'error-recorded',
      data: { error, metadata }
    });
  }

  // Performance profiling
  private updatePerformanceProfile(data: RequestInspectorData): void {
    if (!this.config.enablePerformanceTab || !data.duration) return;

    const key = `${data.method}_${data.endpoint}`;
    let profile = this.performanceProfiles.get(key);

    if (!profile) {
      profile = {
        endpoint: data.endpoint,
        method: data.method,
        samples: [],
        statistics: {
          min: 0,
          max: 0,
          average: 0,
          median: 0,
          p95: 0,
          p99: 0,
          standardDeviation: 0
        }
      };
      this.performanceProfiles.set(key, profile);
    }

    // Add sample
    profile.samples.push({
      timestamp: data.timestamp,
      duration: data.duration,
      status: data.status,
      cacheHit: data.cached
    });

    // Keep only last 100 samples
    if (profile.samples.length > 100) {
      profile.samples = profile.samples.slice(-100);
    }

    // Recalculate statistics
    this.calculateStatistics(profile);
  }

  private calculateStatistics(profile: PerformanceProfile): void {
    const durations = profile.samples.map(s => s.duration).sort((a, b) => a - b);
    const count = durations.length;

    if (count === 0) return;

    profile.statistics.min = durations[0];
    profile.statistics.max = durations[count - 1];
    profile.statistics.average = durations.reduce((sum, d) => sum + d, 0) / count;
    profile.statistics.median = count % 2 === 0
      ? (durations[count / 2 - 1] + durations[count / 2]) / 2
      : durations[Math.floor(count / 2)];
    profile.statistics.p95 = durations[Math.floor(count * 0.95)];
    profile.statistics.p99 = durations[Math.floor(count * 0.99)];

    // Standard deviation
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - profile.statistics.average, 2), 0) / count;
    profile.statistics.standardDeviation = Math.sqrt(variance);
  }

  // Data access methods
  getRequestHistory(filter?: {
    endpoint?: string;
    method?: string;
    status?: number;
    hasError?: boolean;
    timeRange?: { start: Date; end: Date };
  }): RequestInspectorData[] {
    let filtered = this.requestHistory;

    if (filter) {
      filtered = filtered.filter(request => {
        if (filter.endpoint && !request.endpoint.includes(filter.endpoint)) return false;
        if (filter.method && request.method !== filter.method) return false;
        if (filter.status && request.status !== filter.status) return false;
        if (filter.hasError !== undefined && !!request.error !== filter.hasError) return false;
        if (filter.timeRange) {
          const requestTime = new Date(request.timestamp);
          if (requestTime < filter.timeRange.start || requestTime > filter.timeRange.end) return false;
        }
        return true;
      });
    }

    return filtered;
  }

  getPerformanceProfiles(): PerformanceProfile[] {
    return Array.from(this.performanceProfiles.values());
  }

  getErrorPatterns(): Array<{
    pattern: string;
    count: number;
    lastSeen: Date;
    examples: EnhancedApiError[];
  }> {
    return Array.from(this.errorPatterns.entries()).map(([pattern, data]) => ({
      pattern,
      ...data
    }));
  }

  // Performance bottleneck detection
  detectBottlenecks(): {
    slowEndpoints: Array<{
      endpoint: string;
      method: string;
      averageTime: number;
      p95Time: number;
      sampleCount: number;
    }>;
    errorProneEndpoints: Array<{
      endpoint: string;
      method: string;
      errorRate: number;
      totalRequests: number;
    }>;
    cacheInefficiencies: Array<{
      endpoint: string;
      method: string;
      cacheHitRate: number;
      totalRequests: number;
    }>;
  } {
    const slowEndpoints: any[] = [];
    const errorProneEndpoints: any[] = [];
    const cacheInefficiencies: any[] = [];

    // Analyze performance profiles
    this.performanceProfiles.forEach(profile => {
      if (profile.samples.length < 5) return; // Need minimum samples

      // Slow endpoints (average > 2s or p95 > 5s)
      if (profile.statistics.average > 2000 || profile.statistics.p95 > 5000) {
        slowEndpoints.push({
          endpoint: profile.endpoint,
          method: profile.method,
          averageTime: profile.statistics.average,
          p95Time: profile.statistics.p95,
          sampleCount: profile.samples.length
        });
      }

      // Error-prone endpoints
      const errorCount = profile.samples.filter(s => s.status && s.status >= 400).length;
      const errorRate = errorCount / profile.samples.length;
      if (errorRate > 0.1) { // More than 10% error rate
        errorProneEndpoints.push({
          endpoint: profile.endpoint,
          method: profile.method,
          errorRate: errorRate * 100,
          totalRequests: profile.samples.length
        });
      }

      // Cache inefficiencies (for GET requests)
      if (profile.method === 'GET') {
        const cacheHits = profile.samples.filter(s => s.cacheHit).length;
        const cacheHitRate = cacheHits / profile.samples.length;
        if (cacheHitRate < 0.3 && profile.samples.length > 10) { // Less than 30% cache hit rate
          cacheInefficiencies.push({
            endpoint: profile.endpoint,
            method: profile.method,
            cacheHitRate: cacheHitRate * 100,
            totalRequests: profile.samples.length
          });
        }
      }
    });

    return {
      slowEndpoints: slowEndpoints.sort((a, b) => b.averageTime - a.averageTime),
      errorProneEndpoints: errorProneEndpoints.sort((a, b) => b.errorRate - a.errorRate),
      cacheInefficiencies: cacheInefficiencies.sort((a, b) => a.cacheHitRate - b.cacheHitRate)
    };
  }

  // Network timing analysis
  getNetworkTimingAnalysis(): {
    averageLatency: number;
    connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  } {
    const recentRequests = this.requestHistory.slice(0, 50);
    const durations = recentRequests
      .filter(r => r.duration && !r.cached)
      .map(r => r.duration!);

    if (durations.length === 0) {
      return {
        averageLatency: 0,
        connectionQuality: 'excellent',
        recommendations: []
      };
    }

    const averageLatency = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    let connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
    const recommendations: string[] = [];

    if (averageLatency < 500) {
      connectionQuality = 'excellent';
    } else if (averageLatency < 1000) {
      connectionQuality = 'good';
    } else if (averageLatency < 2000) {
      connectionQuality = 'fair';
      recommendations.push('Consider enabling request batching for better performance');
    } else {
      connectionQuality = 'poor';
      recommendations.push('Enable aggressive caching to reduce network requests');
      recommendations.push('Consider implementing offline-first strategies');
      recommendations.push('Optimize payload sizes and use compression');
    }

    // Check for cache opportunities
    const getCacheableRequests = recentRequests.filter(r => r.method === 'GET' && !r.cached);
    if (getCacheableRequests.length > 10) {
      recommendations.push('Many GET requests are not cached - review caching strategy');
    }

    return {
      averageLatency,
      connectionQuality,
      recommendations
    };
  }

  // Utility methods
  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(3, 8).join('\n') : '';
  }

  private getNetworkInfo(): RequestInspectorData['networkInfo'] {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return undefined;
    }

    const connection = (navigator as any).connection;
    return {
      connectionType: connection?.type,
      downlink: connection?.downlink,
      effectiveType: connection?.effectiveType,
      rtt: connection?.rtt
    };
  }

  private initializePerformanceObserver(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'navigation') {
            this.emit({
              type: 'navigation-timing',
              data: entry
            });
          }
        });
      });

      observer.observe({ entryTypes: ['navigation', 'resource'] });
    } catch (error) {
      console.warn('Performance observer not supported:', error);
    }
  }

  // Configuration
  updateConfig(config: Partial<ApiInspectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ApiInspectorConfig {
    return { ...this.config };
  }

  // Data management
  clearHistory(): void {
    this.requestHistory = [];
    this.performanceProfiles.clear();
    this.errorPatterns.clear();
    this.emit({ type: 'history-cleared', data: null });
  }

  exportData(): {
    requestHistory: RequestInspectorData[];
    performanceProfiles: PerformanceProfile[];
    errorPatterns: Array<{ pattern: string; count: number; lastSeen: Date; examples: EnhancedApiError[] }>;
    exportedAt: Date;
  } {
    return {
      requestHistory: this.requestHistory,
      performanceProfiles: Array.from(this.performanceProfiles.values()),
      errorPatterns: this.getErrorPatterns(),
      exportedAt: new Date()
    };
  }

  importData(data: ReturnType<typeof this.exportData>): void {
    this.requestHistory = data.requestHistory;
    this.performanceProfiles = new Map(
      data.performanceProfiles.map(profile => [`${profile.method}_${profile.endpoint}`, profile])
    );
    this.errorPatterns = new Map(
      data.errorPatterns.map(pattern => [pattern.pattern, {
        count: pattern.count,
        lastSeen: pattern.lastSeen,
        examples: pattern.examples
      }])
    );
    this.emit({ type: 'data-imported', data: null });
  }
}

// Event types for the inspector
export type ApiInspectorEvent = 
  | { type: 'request-completed'; data: RequestInspectorData }
  | { type: 'error-recorded'; data: { error: EnhancedApiError; metadata: RequestMetadata } }
  | { type: 'navigation-timing'; data: PerformanceEntry }
  | { type: 'history-cleared'; data: null }
  | { type: 'data-imported'; data: null };

// Singleton instance for development
export const apiInspector = new ApiInspector();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__API_INSPECTOR__ = apiInspector;
}