// Enhanced API Client - Main exports
export * from './types';
export * from './errors';
export * from './metrics';
export * from './cache';
export * from './client';
export * from './batch';
export * from './upload';

// Re-export main classes for convenience
export { EnhancedApiClient, createApiClient } from './client';
export { EnhancedApiError, ErrorRecoveryManager, getUserFriendlyError } from './errors';
export { MetricsCollector, ApiLogger } from './metrics';
export { MemoryCache, LocalStorageCache, MultiTierCacheManager } from './cache';
export { BatchRequestManager } from './batch';
export { FileUploadManager } from './upload';

// Default configured instances
import { createApiClient } from './client';
import { BatchRequestManager } from './batch';
import { FileUploadManager } from './upload';

// Create default instances
const defaultApiClient = createApiClient();
const defaultBatchManager = new BatchRequestManager(defaultApiClient);
const defaultUploadManager = new FileUploadManager(defaultApiClient);

export { 
  defaultApiClient as apiClient,
  defaultBatchManager as batchManager,
  defaultUploadManager as uploadManager
};

// Utility functions
export function createEnhancedApiClient(config?: any) {
  const client = createApiClient(config);
  const batchManager = new BatchRequestManager(client);
  const uploadManager = new FileUploadManager(client);

  return {
    client,
    batchManager,
    uploadManager,
    
    // Convenience methods
    get: client.get.bind(client),
    post: client.post.bind(client),
    put: client.put.bind(client),
    delete: client.delete.bind(client),
    patch: client.patch.bind(client),
    
    batch: batchManager.executeBatch.bind(batchManager),
    upload: uploadManager.uploadFile.bind(uploadManager),
    uploadMultiple: uploadManager.uploadMultipleFiles.bind(uploadManager),
    
    // Configuration
    setAuthToken: client.setAuthToken.bind(client),
    clearAuthToken: client.clearAuthToken.bind(client),
    addInterceptor: client.addInterceptor.bind(client),
    clearCache: client.clearCache.bind(client),
    
    // Monitoring
    getMetrics: client.getMetrics.bind(client),
    getRequestHistory: client.getRequestHistory.bind(client),
    isHealthy: client.isHealthy.bind(client),
    enableDebugMode: client.enableDebugMode.bind(client)
  };
}

// Type-safe API client factory with specific configurations
export function createLearningApiClient() {
  return createEnhancedApiClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    timeout: 30000,
    retryAttempts: 3,
    cacheEnabled: true,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    enableMetrics: true,
    enableLogging: process.env.NODE_ENV === 'development'
  });
}

export function createAIServiceClient() {
  return createEnhancedApiClient({
    baseURL: process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001',
    timeout: 60000, // AI requests can take longer
    retryAttempts: 2,
    cacheEnabled: true,
    cacheTTL: 10 * 60 * 1000, // 10 minutes for AI responses
    enableMetrics: true,
    enableLogging: process.env.NODE_ENV === 'development'
  });
}

// Global error handler setup
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections from API calls
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason instanceof Error && event.reason.name === 'EnhancedApiError') {
        console.error('Unhandled API Error:', event.reason);
        // You can add global error reporting here
      }
    });
  }
}

// Initialize global error handling
if (typeof window !== 'undefined') {
  setupGlobalErrorHandling();
}