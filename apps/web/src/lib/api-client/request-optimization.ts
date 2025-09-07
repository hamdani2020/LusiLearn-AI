import { RequestOptions, ApiResponse, RequestMetadata } from './types';

// Request deduplication interfaces
export interface PendingRequest<T> {
  promise: Promise<ApiResponse<T>>;
  timestamp: number;
  abortController: AbortController;
}

export interface RequestDeduplicationOptions {
  enabled: boolean;
  maxAge: number; // Maximum age of pending request to reuse (ms)
  keyGenerator?: (endpoint: string, method: string, data?: any) => string;
}

// Request batching interfaces
export interface BatchableRequest {
  id: string;
  endpoint: string;
  method: string;
  data?: any;
  options?: RequestOptions;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface BatchingOptions {
  enabled: boolean;
  maxBatchSize: number;
  batchTimeout: number; // Time to wait before executing batch (ms)
  batchableEndpoints: string[]; // Endpoints that can be batched
}

// Request prioritization interfaces
export enum RequestPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface PrioritizedRequest<T> {
  id: string;
  priority: RequestPriority;
  endpoint: string;
  method: string;
  data?: any;
  options?: RequestOptions;
  promise: Promise<ApiResponse<T>>;
  timestamp: number;
  abortController: AbortController;
}

export interface PrioritizationOptions {
  enabled: boolean;
  maxConcurrentRequests: number;
  priorityRules: PriorityRule[];
}

export interface PriorityRule {
  pattern: string | RegExp;
  priority: RequestPriority;
  condition?: (endpoint: string, method: string, data?: any) => boolean;
}

// Request optimization manager
export class RequestOptimizationManager {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private batchQueue: BatchableRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private priorityQueue: PrioritizedRequest<any>[] = [];
  private activePriorityRequests = new Set<string>();
  
  private deduplicationOptions: RequestDeduplicationOptions;
  private batchingOptions: BatchingOptions;
  private prioritizationOptions: PrioritizationOptions;

  constructor(
    deduplicationOptions: Partial<RequestDeduplicationOptions> = {},
    batchingOptions: Partial<BatchingOptions> = {},
    prioritizationOptions: Partial<PrioritizationOptions> = {}
  ) {
    this.deduplicationOptions = {
      enabled: true,
      maxAge: 5000, // 5 seconds
      keyGenerator: this.defaultKeyGenerator,
      ...deduplicationOptions
    };

    this.batchingOptions = {
      enabled: true,
      maxBatchSize: 10,
      batchTimeout: 50, // 50ms
      batchableEndpoints: [
        '/api/v1/learning-paths',
        '/api/v1/progress',
        '/api/v1/content'
      ],
      ...batchingOptions
    };

    this.prioritizationOptions = {
      enabled: true,
      maxConcurrentRequests: 6,
      priorityRules: [
        // Critical: Authentication and health checks
        { pattern: /\/auth\//, priority: RequestPriority.CRITICAL },
        { pattern: /\/health/, priority: RequestPriority.CRITICAL },
        
        // High: User interactions and real-time features
        { pattern: /\/collaboration\//, priority: RequestPriority.HIGH },
        { pattern: /\/messages\//, priority: RequestPriority.HIGH },
        { pattern: /\/progress\/track/, priority: RequestPriority.HIGH },
        
        // Normal: Content and learning paths
        { pattern: /\/learning-paths\//, priority: RequestPriority.NORMAL },
        { pattern: /\/content\//, priority: RequestPriority.NORMAL },
        
        // Low: Analytics and reporting
        { pattern: /\/analytics\//, priority: RequestPriority.LOW },
        { pattern: /\/reports\//, priority: RequestPriority.LOW }
      ],
      ...prioritizationOptions
    };
  }

  // Request deduplication
  async deduplicateRequest<T>(
    endpoint: string,
    method: string,
    data?: any,
    options?: RequestOptions,
    executor?: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    if (!this.deduplicationOptions.enabled || !executor) {
      return executor!();
    }

    const key = this.deduplicationOptions.keyGenerator!(endpoint, method, data);
    const existing = this.pendingRequests.get(key);

    // Check if we have a pending request that's still valid
    if (existing && (Date.now() - existing.timestamp) < this.deduplicationOptions.maxAge) {
      console.debug(`Deduplicating request: ${method} ${endpoint}`);
      return existing.promise;
    }

    // Clean up expired request
    if (existing) {
      existing.abortController.abort();
      this.pendingRequests.delete(key);
    }

    // Create new request
    const abortController = new AbortController();
    const enhancedOptions = {
      ...options,
      signal: abortController.signal
    };

    const promise = executor().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    });

    return promise;
  }

  // Request batching
  async batchRequest<T>(
    endpoint: string,
    method: string,
    data?: any,
    options?: RequestOptions,
    executor?: (requests: BatchableRequest[]) => Promise<ApiResponse<T>[]>
  ): Promise<ApiResponse<T>> {
    if (!this.batchingOptions.enabled || !this.isBatchable(endpoint) || !executor) {
      // Execute immediately if batching is disabled or endpoint is not batchable
      return new Promise((resolve, reject) => {
        const request: BatchableRequest = {
          id: this.generateRequestId(),
          endpoint,
          method,
          data,
          options,
          resolve,
          reject
        };
        
        executor([request]).then(results => {
          if (results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error('No results returned from batch executor'));
          }
        }).catch(reject);
      });
    }

    return new Promise<ApiResponse<T>>((resolve, reject) => {
      const request: BatchableRequest = {
        id: this.generateRequestId(),
        endpoint,
        method,
        data,
        options,
        resolve,
        reject
      };

      this.batchQueue.push(request);

      // Set up batch timer if not already set
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.executeBatch(executor);
        }, this.batchingOptions.batchTimeout);
      }

      // Execute immediately if batch is full
      if (this.batchQueue.length >= this.batchingOptions.maxBatchSize) {
        if (this.batchTimer) {
          clearTimeout(this.batchTimer);
          this.batchTimer = null;
        }
        this.executeBatch(executor);
      }
    });
  }

  // Request prioritization
  async prioritizeRequest<T>(
    endpoint: string,
    method: string,
    data?: any,
    options?: RequestOptions,
    executor?: () => Promise<ApiResponse<T>>
  ): Promise<ApiResponse<T>> {
    if (!this.prioritizationOptions.enabled || !executor) {
      return executor!();
    }

    const priority = this.calculatePriority(endpoint, method, data);
    const requestId = this.generateRequestId();
    const abortController = new AbortController();

    let executeRequest: () => Promise<void>;

    const prioritizedRequest: PrioritizedRequest<T> = {
      id: requestId,
      priority,
      endpoint,
      method,
      data,
      options: {
        ...options,
        signal: abortController.signal
      },
      promise: new Promise<ApiResponse<T>>((resolve, reject) => {
        // This will be resolved when the request is executed
        executeRequest = async () => {
          try {
            this.activePriorityRequests.add(requestId);
            const result = await executor();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.activePriorityRequests.delete(requestId);
            this.processNextPriorityRequest();
          }
        };
      }),
      timestamp: Date.now(),
      abortController
    };

    // Store the executor for later use
    (prioritizedRequest as any).executor = executeRequest;

    // Add to priority queue
    this.addToPriorityQueue(prioritizedRequest);

    // Process queue
    this.processNextPriorityRequest();

    return prioritizedRequest.promise;
  }

  // Optimization statistics
  getOptimizationStats() {
    return {
      deduplication: {
        enabled: this.deduplicationOptions.enabled,
        pendingRequests: this.pendingRequests.size,
        maxAge: this.deduplicationOptions.maxAge
      },
      batching: {
        enabled: this.batchingOptions.enabled,
        queueSize: this.batchQueue.length,
        maxBatchSize: this.batchingOptions.maxBatchSize,
        batchTimeout: this.batchingOptions.batchTimeout
      },
      prioritization: {
        enabled: this.prioritizationOptions.enabled,
        queueSize: this.priorityQueue.length,
        activeRequests: this.activePriorityRequests.size,
        maxConcurrent: this.prioritizationOptions.maxConcurrentRequests
      }
    };
  }

  // Cleanup methods
  clearPendingRequests(): void {
    for (const [key, request] of this.pendingRequests) {
      request.abortController.abort();
    }
    this.pendingRequests.clear();
  }

  clearBatchQueue(): void {
    for (const request of this.batchQueue) {
      request.reject(new Error('Batch queue cleared'));
    }
    this.batchQueue = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  clearPriorityQueue(): void {
    for (const request of this.priorityQueue) {
      request.abortController.abort();
    }
    this.priorityQueue = [];
    this.activePriorityRequests.clear();
  }

  // Private methods
  private defaultKeyGenerator(endpoint: string, method: string, data?: any): string {
    const dataHash = data ? btoa(JSON.stringify(data)).substr(0, 8) : '';
    return `${method}:${endpoint}${dataHash ? `:${dataHash}` : ''}`;
  }

  private isBatchable(endpoint: string): boolean {
    return this.batchingOptions.batchableEndpoints.some(pattern => {
      if (typeof pattern === 'string') {
        return endpoint.includes(pattern);
      }
      return pattern.test(endpoint);
    });
  }

  private async executeBatch<T>(executor: (requests: BatchableRequest[]) => Promise<ApiResponse<T>[]>): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.batchingOptions.maxBatchSize);
    this.batchTimer = null;

    try {
      console.debug(`Executing batch of ${batch.length} requests`);
      const results = await executor(batch);

      // Resolve individual requests
      batch.forEach((request, index) => {
        if (results[index]) {
          request.resolve(results[index]);
        } else {
          request.reject(new Error('No result for batched request'));
        }
      });
    } catch (error) {
      // Reject all requests in the batch
      batch.forEach(request => {
        request.reject(error);
      });
    }

    // Process remaining queue if any
    if (this.batchQueue.length > 0) {
      this.batchTimer = setTimeout(() => {
        this.executeBatch(executor);
      }, this.batchingOptions.batchTimeout);
    }
  }

  private calculatePriority(endpoint: string, method: string, data?: any): RequestPriority {
    for (const rule of this.prioritizationOptions.priorityRules) {
      let matches = false;

      if (typeof rule.pattern === 'string') {
        matches = endpoint.includes(rule.pattern);
      } else {
        matches = rule.pattern.test(endpoint);
      }

      if (matches && (!rule.condition || rule.condition(endpoint, method, data))) {
        return rule.priority;
      }
    }

    return RequestPriority.NORMAL;
  }

  private addToPriorityQueue<T>(request: PrioritizedRequest<T>): void {
    // Insert in priority order (higher priority first, then by timestamp for same priority)
    let insertIndex = 0;
    for (let i = 0; i < this.priorityQueue.length; i++) {
      const existing = this.priorityQueue[i];
      if (request.priority > existing.priority || 
          (request.priority === existing.priority && request.timestamp < existing.timestamp)) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    this.priorityQueue.splice(insertIndex, 0, request);
  }

  private processNextPriorityRequest(): void {
    if (this.activePriorityRequests.size >= this.prioritizationOptions.maxConcurrentRequests) {
      return; // Already at max concurrent requests
    }

    if (this.priorityQueue.length === 0) {
      return; // No requests to process
    }

    const nextRequest = this.priorityQueue.shift()!;
    const executor = (nextRequest as any).executor;

    if (executor) {
      executor();
    }
  }

  private generateRequestId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function
export function createRequestOptimizationManager(
  deduplicationOptions?: Partial<RequestDeduplicationOptions>,
  batchingOptions?: Partial<BatchingOptions>,
  prioritizationOptions?: Partial<PrioritizationOptions>
): RequestOptimizationManager {
  return new RequestOptimizationManager(
    deduplicationOptions,
    batchingOptions,
    prioritizationOptions
  );
}