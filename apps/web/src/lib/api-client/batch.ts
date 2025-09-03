import { BatchRequest, BatchResponse, ApiResponse } from './types';
import { EnhancedApiClient } from './client';

export interface BatchOptions {
  concurrency?: number;
  failFast?: boolean;
  timeout?: number;
  retryFailedRequests?: boolean;
}

export interface BatchRequestWithPriority extends BatchRequest {
  priority?: 'low' | 'normal' | 'high';
  dependencies?: string[]; // IDs of requests this depends on
}

export interface BatchExecutionPlan {
  batches: BatchRequestWithPriority[][];
  totalRequests: number;
  estimatedDuration: number;
}

export class BatchRequestManager {
  private client: EnhancedApiClient;
  private defaultOptions: BatchOptions;

  constructor(client: EnhancedApiClient, options: BatchOptions = {}) {
    this.client = client;
    this.defaultOptions = {
      concurrency: 5,
      failFast: false,
      timeout: 30000,
      retryFailedRequests: true,
      ...options
    };
  }

  async executeBatch<T>(
    requests: BatchRequestWithPriority[],
    options: BatchOptions = {}
  ): Promise<BatchResponse<T>> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    // Create execution plan
    const plan = this.createExecutionPlan(requests);
    
    const results: BatchResponse<T>['results'] = [];
    let successfulRequests = 0;
    let failedRequests = 0;
    let shouldStop = false;

    // Execute batches in dependency order
    for (const batch of plan.batches) {
      if (shouldStop && finalOptions.failFast) {
        // Mark remaining requests as failed
        for (const request of batch) {
          results.push({
            id: request.id,
            success: false,
            error: 'Batch execution stopped due to previous failures'
          });
          failedRequests++;
        }
        continue;
      }

      const batchResults = await this.executeBatchConcurrently<T>(batch, finalOptions);
      
      for (const result of batchResults) {
        results.push(result);
        if (result.success) {
          successfulRequests++;
        } else {
          failedRequests++;
          if (finalOptions.failFast) {
            shouldStop = true;
          }
        }
      }
    }

    // Retry failed requests if enabled
    if (finalOptions.retryFailedRequests && failedRequests > 0 && !shouldStop) {
      const failedResults = results.filter(r => !r.success);
      const retryRequests = requests.filter(r => failedResults.some(fr => fr.id === r.id));
      
      if (retryRequests.length > 0) {
        const retryResults = await this.retryFailedRequests<T>(retryRequests, finalOptions);
        
        // Update results
        for (const retryResult of retryResults) {
          const index = results.findIndex(r => r.id === retryResult.id);
          if (index >= 0) {
            const wasSuccess = results[index].success;
            results[index] = retryResult;
            
            if (!wasSuccess && retryResult.success) {
              successfulRequests++;
              failedRequests--;
            }
          }
        }
      }
    }

    return {
      success: failedRequests === 0,
      results,
      metadata: {
        totalRequests: requests.length,
        successfulRequests,
        failedRequests,
        duration: Date.now() - startTime
      }
    };
  }

  private createExecutionPlan(requests: BatchRequestWithPriority[]): BatchExecutionPlan {
    // Sort by priority and resolve dependencies
    const sortedRequests = this.sortByPriorityAndDependencies(requests);
    
    // Group into batches based on dependencies
    const batches: BatchRequestWithPriority[][] = [];
    const processed = new Set<string>();
    
    while (processed.size < sortedRequests.length) {
      const currentBatch: BatchRequestWithPriority[] = [];
      
      for (const request of sortedRequests) {
        if (processed.has(request.id)) continue;
        
        // Check if all dependencies are satisfied
        const dependenciesSatisfied = !request.dependencies || 
          request.dependencies.every(dep => processed.has(dep));
        
        if (dependenciesSatisfied) {
          currentBatch.push(request);
          processed.add(request.id);
        }
      }
      
      if (currentBatch.length === 0) {
        // Circular dependency or unresolvable dependencies
        const remaining = sortedRequests.filter(r => !processed.has(r.id));
        currentBatch.push(...remaining);
        remaining.forEach(r => processed.add(r.id));
      }
      
      batches.push(currentBatch);
    }

    return {
      batches,
      totalRequests: requests.length,
      estimatedDuration: batches.length * 2000 // Rough estimate
    };
  }

  private sortByPriorityAndDependencies(requests: BatchRequestWithPriority[]): BatchRequestWithPriority[] {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    
    return [...requests].sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // If same priority, consider dependencies
      const aDeps = a.dependencies?.length || 0;
      const bDeps = b.dependencies?.length || 0;
      
      return aDeps - bDeps; // Fewer dependencies first
    });
  }

  private async executeBatchConcurrently<T>(
    batch: BatchRequestWithPriority[],
    options: BatchOptions
  ): Promise<BatchResponse<T>['results']> {
    const concurrency = Math.min(options.concurrency || 5, batch.length);
    const results: BatchResponse<T>['results'] = [];
    
    // Split batch into chunks for concurrent execution
    const chunks = this.chunkArray(batch, concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (request) => {
        try {
          const response = await this.executeRequest<T>(request, options);
          return {
            id: request.id,
            success: response.success,
            data: response.data,
            error: response.error
          };
        } catch (error) {
          return {
            id: request.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    return results;
  }

  private async executeRequest<T>(
    request: BatchRequestWithPriority,
    options: BatchOptions
  ): Promise<ApiResponse<T>> {
    const requestOptions = {
      ...request.options,
      timeout: options.timeout
    };

    switch (request.method) {
      case 'GET':
        return this.client.get<T>(request.endpoint, requestOptions);
      case 'POST':
        return this.client.post<T>(request.endpoint, request.data, requestOptions);
      case 'PUT':
        return this.client.put<T>(request.endpoint, request.data, requestOptions);
      case 'DELETE':
        return this.client.delete<T>(request.endpoint, requestOptions);
      default:
        throw new Error(`Unsupported method: ${request.method}`);
    }
  }

  private async retryFailedRequests<T>(
    requests: BatchRequestWithPriority[],
    options: BatchOptions
  ): Promise<BatchResponse<T>['results']> {
    // Implement exponential backoff for retries
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.executeBatchConcurrently<T>(requests, {
      ...options,
      retryFailedRequests: false // Prevent infinite retry loops
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Utility methods for building batch requests
  static createRequest(
    id: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options?: Partial<BatchRequestWithPriority>
  ): BatchRequestWithPriority {
    return {
      id,
      method,
      endpoint,
      data,
      priority: 'normal',
      ...options
    };
  }

  static createDependentRequest(
    id: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    dependencies: string[],
    data?: any,
    options?: Partial<BatchRequestWithPriority>
  ): BatchRequestWithPriority {
    return {
      id,
      method,
      endpoint,
      data,
      dependencies,
      priority: 'normal',
      ...options
    };
  }

  static createHighPriorityRequest(
    id: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    options?: Partial<BatchRequestWithPriority>
  ): BatchRequestWithPriority {
    return {
      id,
      method,
      endpoint,
      data,
      priority: 'high',
      ...options
    };
  }
}