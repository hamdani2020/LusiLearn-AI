import { RequestMetadata } from '../types';
import { EnhancedApiError } from '../errors';

export interface RequestLoggerConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogSize: number;
  enableConsoleOutput: boolean;
  enablePersistentStorage: boolean;
  enableTimingDetails: boolean;
  enablePayloadLogging: boolean;
  enableStackTraces: boolean;
  sensitiveFields: string[];
}

export interface DetailedRequestLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  type: 'request' | 'response' | 'error' | 'cache' | 'retry';
  endpoint: string;
  method: string;
  
  // Request details
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  
  // Response details
  responseHeaders?: Record<string, string>;
  responsePayload?: any;
  status?: number;
  
  // Timing information
  timing?: {
    start: number;
    end: number;
    duration: number;
    phases?: {
      dns?: number;
      tcp?: number;
      ssl?: number;
      request?: number;
      response?: number;
      processing?: number;
    };
  };
  
  // Error details
  error?: {
    type: string;
    message: string;
    code?: string;
    stack?: string;
    recoverable: boolean;
  };
  
  // Context
  context?: {
    retryCount: number;
    cached: boolean;
    userAgent?: string;
    sessionId?: string;
    userId?: string;
    correlationId?: string;
  };
  
  // Performance metrics
  performance?: {
    memoryUsage?: number;
    networkType?: string;
    connectionSpeed?: string;
  };
}

export class RequestLogger {
  private config: RequestLoggerConfig;
  private logs: DetailedRequestLog[] = [];
  private sessionId: string;
  private correlationIdCounter = 0;

  constructor(config: Partial<RequestLoggerConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      logLevel: 'debug',
      maxLogSize: 1000,
      enableConsoleOutput: true,
      enablePersistentStorage: false,
      enableTimingDetails: true,
      enablePayloadLogging: true,
      enableStackTraces: true,
      sensitiveFields: ['password', 'token', 'authorization', 'cookie', 'x-api-key'],
      ...config
    };

    this.sessionId = this.generateSessionId();
    
    if (this.config.enablePersistentStorage) {
      this.loadPersistedLogs();
    }
  }

  // Main logging methods
  logRequest(
    metadata: RequestMetadata,
    requestData?: {
      headers?: Record<string, string>;
      payload?: any;
    }
  ): string {
    if (!this.config.enabled) return '';

    const correlationId = this.generateCorrelationId();
    const log: DetailedRequestLog = {
      id: `${metadata.id}_request`,
      timestamp: metadata.timestamp,
      level: 'debug',
      type: 'request',
      endpoint: metadata.endpoint,
      method: metadata.method,
      requestHeaders: this.sanitizeHeaders(requestData?.headers),
      requestPayload: this.config.enablePayloadLogging 
        ? this.sanitizePayload(requestData?.payload)
        : undefined,
      timing: {
        start: metadata.timestamp.getTime(),
        end: 0,
        duration: 0
      },
      context: {
        retryCount: metadata.retryCount,
        cached: metadata.cached,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        sessionId: this.sessionId,
        correlationId
      },
      performance: this.capturePerformanceMetrics()
    };

    this.addLog(log);
    return correlationId;
  }

  logResponse(
    metadata: RequestMetadata,
    responseData?: {
      headers?: Record<string, string>;
      payload?: any;
    },
    correlationId?: string
  ): void {
    if (!this.config.enabled) return;

    const log: DetailedRequestLog = {
      id: `${metadata.id}_response`,
      timestamp: new Date(),
      level: metadata.error ? 'error' : 'debug',
      type: 'response',
      endpoint: metadata.endpoint,
      method: metadata.method,
      responseHeaders: this.sanitizeHeaders(responseData?.headers),
      responsePayload: this.config.enablePayloadLogging 
        ? this.sanitizePayload(responseData?.payload)
        : undefined,
      status: metadata.status,
      timing: {
        start: metadata.timestamp.getTime(),
        end: Date.now(),
        duration: metadata.duration || 0,
        phases: this.extractTimingPhases(metadata)
      },
      context: {
        retryCount: metadata.retryCount,
        cached: metadata.cached,
        sessionId: this.sessionId,
        correlationId
      },
      performance: this.capturePerformanceMetrics()
    };

    this.addLog(log);
  }

  logError(
    error: EnhancedApiError,
    metadata: RequestMetadata,
    correlationId?: string
  ): void {
    if (!this.config.enabled) return;

    const log: DetailedRequestLog = {
      id: `${metadata.id}_error`,
      timestamp: new Date(),
      level: 'error',
      type: 'error',
      endpoint: metadata.endpoint,
      method: metadata.method,
      status: error.status,
      error: {
        type: error.type,
        message: error.message,
        code: error.code,
        stack: this.config.enableStackTraces ? error.stack : undefined,
        recoverable: error.recoverable
      },
      timing: {
        start: metadata.timestamp.getTime(),
        end: Date.now(),
        duration: metadata.duration || 0
      },
      context: {
        retryCount: metadata.retryCount,
        cached: metadata.cached,
        sessionId: this.sessionId,
        correlationId
      },
      performance: this.capturePerformanceMetrics()
    };

    this.addLog(log);
  }

  logCacheHit(endpoint: string, method: string, correlationId?: string): void {
    if (!this.config.enabled) return;

    const log: DetailedRequestLog = {
      id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: 'debug',
      type: 'cache',
      endpoint,
      method,
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      },
      context: {
        retryCount: 0,
        cached: true,
        sessionId: this.sessionId,
        correlationId
      }
    };

    this.addLog(log);
  }

  logRetry(
    metadata: RequestMetadata,
    reason: string,
    correlationId?: string
  ): void {
    if (!this.config.enabled) return;

    const log: DetailedRequestLog = {
      id: `${metadata.id}_retry_${metadata.retryCount}`,
      timestamp: new Date(),
      level: 'warn',
      type: 'retry',
      endpoint: metadata.endpoint,
      method: metadata.method,
      error: {
        type: 'retry',
        message: reason,
        recoverable: true
      },
      context: {
        retryCount: metadata.retryCount,
        cached: metadata.cached,
        sessionId: this.sessionId,
        correlationId
      }
    };

    this.addLog(log);
  }

  // Data sanitization
  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      if (this.config.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  private sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const sanitized = Array.isArray(payload) ? [] : {};
    
    for (const [key, value] of Object.entries(payload)) {
      const lowerKey = key.toLowerCase();
      if (this.config.sensitiveFields.some(field => lowerKey.includes(field))) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizePayload(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  // Performance and timing
  private capturePerformanceMetrics(): DetailedRequestLog['performance'] {
    const performance: DetailedRequestLog['performance'] = {};

    // Memory usage
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      const memory = (window.performance as any).memory;
      performance.memoryUsage = memory.usedJSHeapSize;
    }

    // Network information
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      performance.networkType = connection?.effectiveType;
      performance.connectionSpeed = connection?.downlink ? `${connection.downlink}Mbps` : undefined;
    }

    return performance;
  }

  private extractTimingPhases(metadata: RequestMetadata): DetailedRequestLog['timing']['phases'] {
    // In a real implementation, this would extract detailed timing from
    // performance.getEntriesByType('resource') or similar APIs
    if (!metadata.duration) return undefined;

    const total = metadata.duration;
    return {
      dns: total * 0.05,
      tcp: total * 0.05,
      ssl: total * 0.1,
      request: total * 0.1,
      response: total * 0.6,
      processing: total * 0.1
    };
  }

  // Log management
  private addLog(log: DetailedRequestLog): void {
    // Add to memory
    this.logs.unshift(log);
    if (this.logs.length > this.config.maxLogSize) {
      this.logs = this.logs.slice(0, this.config.maxLogSize);
    }

    // Console output
    if (this.config.enableConsoleOutput && this.shouldLog(log.level)) {
      this.outputToConsole(log);
    }

    // Persistent storage
    if (this.config.enablePersistentStorage) {
      this.persistLog(log);
    }
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= configLevelIndex;
  }

  private outputToConsole(log: DetailedRequestLog): void {
    const prefix = `[API ${log.type.toUpperCase()}]`;
    const message = `${prefix} ${log.method} ${log.endpoint}`;
    
    const details: any = {
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      duration: log.timing?.duration,
      status: log.status,
      cached: log.context?.cached,
      retryCount: log.context?.retryCount
    };

    if (log.requestPayload) details.request = log.requestPayload;
    if (log.responsePayload) details.response = log.responsePayload;
    if (log.error) details.error = log.error;
    if (log.timing?.phases) details.timing = log.timing.phases;

    switch (log.level) {
      case 'debug':
        console.debug(message, details);
        break;
      case 'info':
        console.info(message, details);
        break;
      case 'warn':
        console.warn(message, details);
        break;
      case 'error':
        console.error(message, details);
        break;
    }
  }

  // Persistent storage
  private persistLog(log: DetailedRequestLog): void {
    try {
      const key = `api_logs_${this.sessionId}`;
      const existing = localStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      logs.unshift(log);
      if (logs.length > 100) { // Keep only last 100 logs in storage
        logs.splice(100);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to persist log:', error);
    }
  }

  private loadPersistedLogs(): void {
    try {
      const key = `api_logs_${this.sessionId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const logs = JSON.parse(stored);
        this.logs = logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load persisted logs:', error);
    }
  }

  // Data access
  getLogs(filter?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    type?: 'request' | 'response' | 'error' | 'cache' | 'retry';
    endpoint?: string;
    method?: string;
    timeRange?: { start: Date; end: Date };
    correlationId?: string;
  }): DetailedRequestLog[] {
    let filtered = this.logs;

    if (filter) {
      filtered = filtered.filter(log => {
        if (filter.level && log.level !== filter.level) return false;
        if (filter.type && log.type !== filter.type) return false;
        if (filter.endpoint && !log.endpoint.includes(filter.endpoint)) return false;
        if (filter.method && log.method !== filter.method) return false;
        if (filter.correlationId && log.context?.correlationId !== filter.correlationId) return false;
        if (filter.timeRange) {
          if (log.timestamp < filter.timeRange.start || log.timestamp > filter.timeRange.end) return false;
        }
        return true;
      });
    }

    return filtered;
  }

  getLogsByCorrelationId(correlationId: string): DetailedRequestLog[] {
    return this.logs.filter(log => log.context?.correlationId === correlationId);
  }

  getErrorLogs(): DetailedRequestLog[] {
    return this.logs.filter(log => log.level === 'error' || log.type === 'error');
  }

  getSlowRequests(threshold: number = 2000): DetailedRequestLog[] {
    return this.logs.filter(log => 
      log.type === 'response' && 
      log.timing && 
      log.timing.duration > threshold
    );
  }

  // Statistics and analysis
  getLogStatistics(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByType: Record<string, number>;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const logsByLevel: Record<string, number> = {};
    const logsByType: Record<string, number> = {};
    const endpointCounts: Record<string, number> = {};
    
    let totalResponseTime = 0;
    let responseCount = 0;
    let errorCount = 0;
    let cacheHitCount = 0;

    this.logs.forEach(log => {
      // Count by level
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;
      
      // Count by type
      logsByType[log.type] = (logsByType[log.type] || 0) + 1;
      
      // Count endpoints
      endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
      
      // Response time calculation
      if (log.type === 'response' && log.timing?.duration) {
        totalResponseTime += log.timing.duration;
        responseCount++;
      }
      
      // Error rate calculation
      if (log.level === 'error') {
        errorCount++;
      }
      
      // Cache hit rate
      if (log.context?.cached) {
        cacheHitCount++;
      }
    });

    const topEndpoints = Object.entries(endpointCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      logsByType,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      errorRate: this.logs.length > 0 ? (errorCount / this.logs.length) * 100 : 0,
      cacheHitRate: this.logs.length > 0 ? (cacheHitCount / this.logs.length) * 100 : 0,
      topEndpoints
    };
  }

  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${++this.correlationIdCounter}`;
  }

  // Configuration and cleanup
  updateConfig(config: Partial<RequestLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): RequestLoggerConfig {
    return { ...this.config };
  }

  clearLogs(): void {
    this.logs = [];
    if (this.config.enablePersistentStorage) {
      try {
        const key = `api_logs_${this.sessionId}`;
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Failed to clear persisted logs:', error);
      }
    }
  }

  exportLogs(): {
    sessionId: string;
    exportedAt: Date;
    logs: DetailedRequestLog[];
    statistics: ReturnType<typeof this.getLogStatistics>;
  } {
    return {
      sessionId: this.sessionId,
      exportedAt: new Date(),
      logs: this.logs,
      statistics: this.getLogStatistics()
    };
  }
}

// Singleton instance for development
export const requestLogger = new RequestLogger();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__REQUEST_LOGGER__ = requestLogger;
}