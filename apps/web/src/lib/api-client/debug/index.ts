export { ApiInspector, apiInspector } from './api-inspector';
export type { 
  ApiInspectorConfig, 
  RequestInspectorData, 
  PerformanceProfile,
  ApiInspectorEvent 
} from './api-inspector';

export { PerformanceProfiler, performanceProfiler } from './performance-profiler';
export type { 
  PerformanceProfilerConfig, 
  TimingBreakdown, 
  MemorySnapshot, 
  PerformanceSample, 
  PerformanceAlert 
} from './performance-profiler';

export { RequestLogger, requestLogger } from './request-logger';
export type { 
  RequestLoggerConfig, 
  DetailedRequestLog 
} from './request-logger';

// Combined debugging interface
export interface DebugToolsConfig {
  inspector: Partial<import('./api-inspector').ApiInspectorConfig>;
  profiler: Partial<import('./performance-profiler').PerformanceProfilerConfig>;
  logger: Partial<import('./request-logger').RequestLoggerConfig>;
}

export class DebugTools {
  constructor(config: Partial<DebugToolsConfig> = {}) {
    if (config.inspector) {
      apiInspector.updateConfig(config.inspector);
    }
    if (config.profiler) {
      performanceProfiler.updateConfig(config.profiler);
    }
    if (config.logger) {
      requestLogger.updateConfig(config.logger);
    }
  }

  // Unified data access
  getDebugSummary() {
    return {
      inspector: {
        requestCount: apiInspector.getRequestHistory().length,
        errorPatterns: apiInspector.getErrorPatterns().length,
        bottlenecks: apiInspector.detectBottlenecks()
      },
      profiler: {
        sampleCount: performanceProfiler.getSamples().length,
        alertCount: performanceProfiler.getAlerts().length,
        statistics: performanceProfiler.getPerformanceStatistics()
      },
      logger: {
        logCount: requestLogger.getLogs().length,
        statistics: requestLogger.getLogStatistics()
      }
    };
  }

  // Export all debug data
  exportAllData() {
    return {
      timestamp: new Date(),
      inspector: apiInspector.exportData(),
      profiler: {
        samples: performanceProfiler.getSamples(),
        alerts: performanceProfiler.getAlerts(),
        statistics: performanceProfiler.getPerformanceStatistics()
      },
      logger: requestLogger.exportLogs()
    };
  }

  // Clear all debug data
  clearAllData() {
    apiInspector.clearHistory();
    performanceProfiler.clearData();
    requestLogger.clearLogs();
  }

  // Enable/disable all tools
  setEnabled(enabled: boolean) {
    apiInspector.updateConfig({ enabled });
    performanceProfiler.updateConfig({ enabled });
    requestLogger.updateConfig({ enabled });
  }
}

// Singleton instance
export const debugTools = new DebugTools();

// Development-only global access
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__DEBUG_TOOLS__ = debugTools;
  
  // Add helpful console commands
  (window as any).apiDebug = {
    summary: () => debugTools.getDebugSummary(),
    export: () => debugTools.exportAllData(),
    clear: () => debugTools.clearAllData(),
    inspector: apiInspector,
    profiler: performanceProfiler,
    logger: requestLogger
  };
  
  console.log('🔧 API Debug tools available at window.apiDebug');
}