import { RequestMetadata } from '../types';

export interface PerformanceProfilerConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of requests to profile
  maxSamples: number;
  enableMemoryProfiling: boolean;
  enableTimingBreakdown: boolean;
}

export interface TimingBreakdown {
  dns: number;
  tcp: number;
  ssl: number;
  request: number;
  response: number;
  processing: number;
  total: number;
}

export interface MemorySnapshot {
  timestamp: Date;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceSample {
  requestId: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  timing: TimingBreakdown;
  memory?: MemorySnapshot;
  networkInfo?: {
    connectionType?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
  resourceTiming?: PerformanceResourceTiming;
}

export interface PerformanceAlert {
  type: 'slow-request' | 'memory-leak' | 'high-latency' | 'cache-miss';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: any;
  timestamp: Date;
}

export class PerformanceProfiler {
  private config: PerformanceProfilerConfig;
  private samples: PerformanceSample[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private listeners: Set<(alert: PerformanceAlert) => void> = new Set();

  constructor(config: Partial<PerformanceProfilerConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      sampleRate: 1.0, // Profile all requests in development
      maxSamples: 1000,
      enableMemoryProfiling: true,
      enableTimingBreakdown: true,
      ...config
    };

    if (this.config.enabled && typeof window !== 'undefined') {
      this.initializeObservers();
      this.startMemoryMonitoring();
    }
  }

  // Event listeners for alerts
  onAlert(listener: (alert: PerformanceAlert) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitAlert(alert: PerformanceAlert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
    this.listeners.forEach(listener => listener(alert));
  }

  // Profile a request
  profileRequest(metadata: RequestMetadata): void {
    if (!this.config.enabled || !this.shouldSample()) return;

    const sample = this.createPerformanceSample(metadata);
    if (sample) {
      this.samples.unshift(sample);
      if (this.samples.length > this.config.maxSamples) {
        this.samples = this.samples.slice(0, this.config.maxSamples);
      }

      this.analyzePerformance(sample);
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private createPerformanceSample(metadata: RequestMetadata): PerformanceSample | null {
    if (!metadata.duration) return null;

    const sample: PerformanceSample = {
      requestId: metadata.id,
      endpoint: metadata.endpoint,
      method: metadata.method,
      timestamp: metadata.timestamp,
      timing: this.extractTimingBreakdown(metadata),
      networkInfo: this.getNetworkInfo()
    };

    // Add memory snapshot if enabled
    if (this.config.enableMemoryProfiling) {
      sample.memory = this.captureMemorySnapshot();
    }

    // Try to get resource timing
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const matchingEntry = resourceEntries.find(entry => 
        entry.name.includes(metadata.endpoint) && 
        Math.abs(entry.startTime - metadata.timestamp.getTime()) < 1000
      );
      if (matchingEntry) {
        sample.resourceTiming = matchingEntry;
      }
    }

    return sample;
  }

  private extractTimingBreakdown(metadata: RequestMetadata): TimingBreakdown {
    // Default breakdown - in a real implementation, this would come from
    // more detailed timing information
    const total = metadata.duration || 0;
    
    return {
      dns: 0,
      tcp: 0,
      ssl: 0,
      request: total * 0.1,
      response: total * 0.8,
      processing: total * 0.1,
      total
    };
  }

  private captureMemorySnapshot(): MemorySnapshot | undefined {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return undefined;
    }

    const memory = (performance as any).memory;
    return {
      timestamp: new Date(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }

  private getNetworkInfo() {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return undefined;
    }

    const connection = (navigator as any).connection;
    return {
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };
  }

  // Performance analysis
  private analyzePerformance(sample: PerformanceSample): void {
    // Check for slow requests
    if (sample.timing.total > 5000) {
      this.emitAlert({
        type: 'slow-request',
        severity: 'high',
        message: `Very slow request detected: ${sample.method} ${sample.endpoint} took ${sample.timing.total}ms`,
        data: sample,
        timestamp: new Date()
      });
    } else if (sample.timing.total > 2000) {
      this.emitAlert({
        type: 'slow-request',
        severity: 'medium',
        message: `Slow request detected: ${sample.method} ${sample.endpoint} took ${sample.timing.total}ms`,
        data: sample,
        timestamp: new Date()
      });
    }

    // Check for high latency
    if (sample.networkInfo?.rtt && sample.networkInfo.rtt > 500) {
      this.emitAlert({
        type: 'high-latency',
        severity: 'medium',
        message: `High network latency detected: ${sample.networkInfo.rtt}ms RTT`,
        data: sample,
        timestamp: new Date()
      });
    }

    // Memory leak detection
    if (sample.memory) {
      this.checkMemoryLeaks(sample.memory);
    }
  }

  private checkMemoryLeaks(snapshot: MemorySnapshot): void {
    this.memorySnapshots.unshift(snapshot);
    if (this.memorySnapshots.length > 50) {
      this.memorySnapshots = this.memorySnapshots.slice(0, 50);
    }

    // Check for consistent memory growth
    if (this.memorySnapshots.length >= 10) {
      const recent = this.memorySnapshots.slice(0, 10);
      const oldest = recent[recent.length - 1];
      const newest = recent[0];
      
      const growthRate = (newest.usedJSHeapSize - oldest.usedJSHeapSize) / oldest.usedJSHeapSize;
      
      if (growthRate > 0.5) { // 50% growth in recent samples
        this.emitAlert({
          type: 'memory-leak',
          severity: 'high',
          message: `Potential memory leak detected: ${(growthRate * 100).toFixed(1)}% growth in heap usage`,
          data: { oldest, newest, growthRate },
          timestamp: new Date()
        });
      }
    }
  }

  // Observer initialization
  private initializeObservers(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        entries.forEach(entry => {
          if (entry.name.includes('/api/')) {
            this.analyzeResourceTiming(entry);
          }
        });
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Navigation timing observer
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceNavigationTiming[];
        entries.forEach(entry => {
          this.analyzeNavigationTiming(entry);
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);

      // Long task observer
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.emitAlert({
              type: 'slow-request',
              severity: 'medium',
              message: `Long task detected: ${entry.duration.toFixed(1)}ms`,
              data: entry,
              timestamp: new Date()
            });
          }
        });
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);

    } catch (error) {
      console.warn('Failed to initialize performance observers:', error);
    }
  }

  private analyzeResourceTiming(entry: PerformanceResourceTiming): void {
    const duration = entry.responseEnd - entry.startTime;
    
    if (duration > 3000) {
      this.emitAlert({
        type: 'slow-request',
        severity: 'medium',
        message: `Slow resource load: ${entry.name} took ${duration.toFixed(1)}ms`,
        data: entry,
        timestamp: new Date()
      });
    }
  }

  private analyzeNavigationTiming(entry: PerformanceNavigationTiming): void {
    const loadTime = entry.loadEventEnd - entry.navigationStart;
    
    if (loadTime > 5000) {
      this.emitAlert({
        type: 'slow-request',
        severity: 'high',
        message: `Slow page load: ${loadTime.toFixed(1)}ms`,
        data: entry,
        timestamp: new Date()
      });
    }
  }

  private startMemoryMonitoring(): void {
    if (!this.config.enableMemoryProfiling) return;

    // Monitor memory every 30 seconds
    setInterval(() => {
      const snapshot = this.captureMemorySnapshot();
      if (snapshot) {
        this.checkMemoryLeaks(snapshot);
      }
    }, 30000);
  }

  // Data access methods
  getSamples(filter?: {
    endpoint?: string;
    method?: string;
    timeRange?: { start: Date; end: Date };
    minDuration?: number;
  }): PerformanceSample[] {
    let filtered = this.samples;

    if (filter) {
      filtered = filtered.filter(sample => {
        if (filter.endpoint && !sample.endpoint.includes(filter.endpoint)) return false;
        if (filter.method && sample.method !== filter.method) return false;
        if (filter.minDuration && sample.timing.total < filter.minDuration) return false;
        if (filter.timeRange) {
          if (sample.timestamp < filter.timeRange.start || sample.timestamp > filter.timeRange.end) return false;
        }
        return true;
      });
    }

    return filtered;
  }

  getAlerts(severity?: 'low' | 'medium' | 'high'): PerformanceAlert[] {
    return severity 
      ? this.alerts.filter(alert => alert.severity === severity)
      : this.alerts;
  }

  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  // Performance statistics
  getPerformanceStatistics(): {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestEndpoints: Array<{
      endpoint: string;
      method: string;
      averageTime: number;
      sampleCount: number;
    }>;
    memoryTrend: {
      current: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      changeRate: number;
    };
    networkQuality: {
      averageRTT: number;
      connectionType: string;
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  } {
    const durations = this.samples.map(s => s.timing.total).sort((a, b) => a - b);
    const averageResponseTime = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const p95ResponseTime = durations.length > 0 
      ? durations[Math.floor(durations.length * 0.95)] 
      : 0;

    const p99ResponseTime = durations.length > 0 
      ? durations[Math.floor(durations.length * 0.99)] 
      : 0;

    // Calculate slowest endpoints
    const endpointStats = new Map<string, { total: number; count: number }>();
    this.samples.forEach(sample => {
      const key = `${sample.method}_${sample.endpoint}`;
      const existing = endpointStats.get(key);
      if (existing) {
        existing.total += sample.timing.total;
        existing.count++;
      } else {
        endpointStats.set(key, { total: sample.timing.total, count: 1 });
      }
    });

    const slowestEndpoints = Array.from(endpointStats.entries())
      .map(([key, stats]) => {
        const [method, endpoint] = key.split('_', 2);
        return {
          endpoint,
          method,
          averageTime: stats.total / stats.count,
          sampleCount: stats.count
        };
      })
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Memory trend analysis
    let memoryTrend: any = {
      current: 0,
      trend: 'stable' as const,
      changeRate: 0
    };

    if (this.memorySnapshots.length >= 2) {
      const recent = this.memorySnapshots[0];
      const older = this.memorySnapshots[Math.min(9, this.memorySnapshots.length - 1)];
      
      memoryTrend.current = recent.usedJSHeapSize;
      memoryTrend.changeRate = (recent.usedJSHeapSize - older.usedJSHeapSize) / older.usedJSHeapSize;
      
      if (memoryTrend.changeRate > 0.1) {
        memoryTrend.trend = 'increasing';
      } else if (memoryTrend.changeRate < -0.1) {
        memoryTrend.trend = 'decreasing';
      }
    }

    // Network quality analysis
    const networkSamples = this.samples.filter(s => s.networkInfo?.rtt).map(s => s.networkInfo!);
    const averageRTT = networkSamples.length > 0
      ? networkSamples.reduce((sum, n) => sum + n.rtt!, 0) / networkSamples.length
      : 0;

    const connectionType = networkSamples.length > 0 
      ? networkSamples[0].effectiveType || 'unknown'
      : 'unknown';

    let networkQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (averageRTT > 500) networkQuality = 'poor';
    else if (averageRTT > 200) networkQuality = 'fair';
    else if (averageRTT > 100) networkQuality = 'good';

    return {
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      slowestEndpoints,
      memoryTrend,
      networkQuality: {
        averageRTT,
        connectionType,
        quality: networkQuality
      }
    };
  }

  // Configuration and cleanup
  updateConfig(config: Partial<PerformanceProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): PerformanceProfilerConfig {
    return { ...this.config };
  }

  clearData(): void {
    this.samples = [];
    this.memorySnapshots = [];
    this.alerts = [];
  }

  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.listeners.clear();
    this.clearData();
  }
}

// Singleton instance for development
export const performanceProfiler = new PerformanceProfiler();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__PERFORMANCE_PROFILER__ = performanceProfiler;
}