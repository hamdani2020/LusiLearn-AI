import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  RequestOptimizationManager,
  RequestPriority,
  PriorityRule,
  BatchableRequest
} from '../request-optimization';
import { ApiResponse } from '../types';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';
import { vi } from 'date-fns/locale';

// Mock timers
jest.useFakeTimers();

describe('RequestOptimizationManager', () => {
  let manager: RequestOptimizationManager;
  let mockExecutor: jest.MockedFunction<any>;
  let mockBatchExecutor: jest.MockedFunction<any>;

  beforeEach(() => {
    manager = new RequestOptimizationManager();
    mockExecutor = jest.fn();
    mockBatchExecutor = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const mockResponse: ApiResponse<any> = {
        success: true,
        data: { id: 1, name: 'test' }
      };

      mockExecutor.mockResolvedValue(mockResponse);

      // Make two identical requests
      const promise1 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      const promise2 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should return the same result
      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
      
      // Should only execute once
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it('should not deduplicate requests with different data', async () => {
      const mockResponse1: ApiResponse<any> = { success: true, data: { id: 1 } };
      const mockResponse2: ApiResponse<any> = { success: true, data: { id: 2 } };

      mockExecutor
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const promise1 = manager.deduplicateRequest(
        '/api/test',
        'POST',
        { id: 1 },
        {},
        mockExecutor
      );

      const promise2 = manager.deduplicateRequest(
        '/api/test',
        'POST',
        { id: 2 },
        {},
        mockExecutor
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockResponse1);
      expect(result2).toEqual(mockResponse2);
      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });

    it('should not deduplicate expired requests', async () => {
      const mockResponse1: ApiResponse<any> = { success: true, data: { id: 1 } };
      const mockResponse2: ApiResponse<any> = { success: true, data: { id: 2 } };

      mockExecutor
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // First request
      const promise1 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      await promise1;

      // Advance time beyond maxAge
      jest.advanceTimersByTime(6000);

      // Second request should not be deduplicated
      const promise2 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      await promise2;

      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });

    it('should handle request failures in deduplication', async () => {
      const error = new Error('Request failed');
      mockExecutor.mockRejectedValue(error);

      const promise1 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      const promise2 = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      await expect(promise1).rejects.toThrow('Request failed');
      await expect(promise2).rejects.toThrow('Request failed');
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Batching', () => {
    it('should batch requests when timeout is reached', async () => {
      const mockResponses: ApiResponse<any>[] = [
        { success: true, data: { id: 1 } },
        { success: true, data: { id: 2 } }
      ];

      mockBatchExecutor.mockResolvedValue(mockResponses);

      const promise1 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const promise2 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      // Advance time to trigger batch execution
      jest.advanceTimersByTime(100);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockResponses[0]);
      expect(result2).toEqual(mockResponses[1]);
      expect(mockBatchExecutor).toHaveBeenCalledTimes(1);
      expect(mockBatchExecutor).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ endpoint: '/api/v1/learning-paths' }),
          expect.objectContaining({ endpoint: '/api/v1/learning-paths' })
        ])
      );
    });

    it('should execute batch immediately when max size is reached', async () => {
      // Create manager with small batch size for testing
      const testManager = new RequestOptimizationManager(
        {},
        { maxBatchSize: 2, batchTimeout: 1000 },
        {}
      );

      const mockResponses: ApiResponse<any>[] = [
        { success: true, data: { id: 1 } },
        { success: true, data: { id: 2 } }
      ];

      mockBatchExecutor.mockResolvedValue(mockResponses);

      const promise1 = testManager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const promise2 = testManager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      // Should execute immediately without waiting for timeout
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(mockResponses[0]);
      expect(result2).toEqual(mockResponses[1]);
      expect(mockBatchExecutor).toHaveBeenCalledTimes(1);
    });

    it('should not batch non-batchable endpoints', async () => {
      const mockResponse: ApiResponse<any> = { success: true, data: { id: 1 } };
      mockBatchExecutor.mockResolvedValue([mockResponse]);

      const promise = manager.batchRequest(
        '/api/v1/non-batchable',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const result = await promise;

      expect(result).toEqual(mockResponse);
      expect(mockBatchExecutor).toHaveBeenCalledWith([
        expect.objectContaining({ endpoint: '/api/v1/non-batchable' })
      ]);
    });

    it('should handle batch execution failures', async () => {
      const error = new Error('Batch execution failed');
      mockBatchExecutor.mockRejectedValue(error);

      const promise1 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const promise2 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      jest.advanceTimersByTime(100);

      await expect(promise1).rejects.toThrow('Batch execution failed');
      await expect(promise2).rejects.toThrow('Batch execution failed');
    });
  });

  describe('Request Prioritization', () => {
    it('should prioritize critical requests', async () => {
      const executionOrder: string[] = [];
      
      const createMockExecutor = (id: string) => jest.fn().mockImplementation(async () => {
        executionOrder.push(id);
        return { success: true, data: { id } };
      });

      const criticalExecutor = createMockExecutor('critical');
      const normalExecutor = createMockExecutor('normal');
      const lowExecutor = createMockExecutor('low');

      // Create manager with low concurrency for testing
      const testManager = new RequestOptimizationManager(
        {},
        {},
        { maxConcurrentRequests: 1 }
      );

      // Submit requests in reverse priority order
      const lowPromise = testManager.prioritizeRequest(
        '/api/v1/analytics/report',
        'GET',
        undefined,
        {},
        lowExecutor
      );

      const normalPromise = testManager.prioritizeRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        normalExecutor
      );

      const criticalPromise = testManager.prioritizeRequest(
        '/api/v1/auth/verify',
        'GET',
        undefined,
        {},
        criticalExecutor
      );

      await Promise.all([lowPromise, normalPromise, criticalPromise]);

      // Critical should execute first, then normal, then low
      expect(executionOrder).toEqual(['critical', 'normal', 'low']);
    });

    it('should respect concurrency limits', async () => {
      let activeRequests = 0;
      let maxConcurrent = 0;

      const createMockExecutor = (id: string) => jest.fn().mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        
        activeRequests--;
        return { success: true, data: { id } };
      });

      const testManager = new RequestOptimizationManager(
        {},
        {},
        { maxConcurrentRequests: 2 }
      );

      const promises = Array.from({ length: 5 }, (_, i) => 
        testManager.prioritizeRequest(
          `/api/v1/test/${i}`,
          'GET',
          undefined,
          {},
          createMockExecutor(`request-${i}`)
        )
      );

      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should handle priority request failures', async () => {
      const error = new Error('Priority request failed');
      mockExecutor.mockRejectedValue(error);

      const promise = manager.prioritizeRequest(
        '/api/v1/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      await expect(promise).rejects.toThrow('Priority request failed');
    });

    it('should process requests in timestamp order for same priority', async () => {
      const executionOrder: string[] = [];
      
      const createMockExecutor = (id: string) => jest.fn().mockImplementation(async () => {
        executionOrder.push(id);
        return { success: true, data: { id } };
      });

      const testManager = new RequestOptimizationManager(
        {},
        {},
        { maxConcurrentRequests: 1 }
      );

      // Submit multiple normal priority requests
      const promise1 = testManager.prioritizeRequest(
        '/api/v1/content/1',
        'GET',
        undefined,
        {},
        createMockExecutor('first')
      );

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      const promise2 = testManager.prioritizeRequest(
        '/api/v1/content/2',
        'GET',
        undefined,
        {},
        createMockExecutor('second')
      );

      await Promise.all([promise1, promise2]);

      expect(executionOrder).toEqual(['first', 'second']);
    });
  });

  describe('Optimization Statistics', () => {
    it('should provide accurate optimization statistics', () => {
      const stats = manager.getOptimizationStats();

      expect(stats).toEqual({
        deduplication: {
          enabled: true,
          pendingRequests: 0,
          maxAge: 5000
        },
        batching: {
          enabled: true,
          queueSize: 0,
          maxBatchSize: 10,
          batchTimeout: 50
        },
        prioritization: {
          enabled: true,
          queueSize: 0,
          activeRequests: 0,
          maxConcurrent: 6
        }
      });
    });

    it('should update statistics as requests are processed', async () => {
      // Add a request to deduplication
      const dedupePromise = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      );

      // Add requests to batch queue
      const batchPromise1 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const batchPromise2 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      // Check stats before completion
      const statsBeforeCompletion = manager.getOptimizationStats();
      expect(statsBeforeCompletion.deduplication.pendingRequests).toBe(1);
      expect(statsBeforeCompletion.batching.queueSize).toBe(2);

      // Complete the requests
      mockBatchExecutor.mockResolvedValue([
        { success: true, data: { id: 1 } },
        { success: true, data: { id: 2 } }
      ]);

      jest.advanceTimersByTime(100);
      await Promise.all([dedupePromise, batchPromise1, batchPromise2]);

      // Check stats after completion
      const statsAfterCompletion = manager.getOptimizationStats();
      expect(statsAfterCompletion.deduplication.pendingRequests).toBe(0);
      expect(statsAfterCompletion.batching.queueSize).toBe(0);
    });
  });

  describe('Cleanup Methods', () => {
    it('should clear pending requests', async () => {
      const promise = manager.deduplicateRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
      );

      expect(manager.getOptimizationStats().deduplication.pendingRequests).toBe(1);

      manager.clearPendingRequests();

      expect(manager.getOptimizationStats().deduplication.pendingRequests).toBe(0);
      
      // The promise should be rejected due to abort
      await expect(promise).rejects.toThrow();
    });

    it('should clear batch queue', async () => {
      const promise1 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      const promise2 = manager.batchRequest(
        '/api/v1/learning-paths',
        'GET',
        undefined,
        {},
        mockBatchExecutor
      );

      expect(manager.getOptimizationStats().batching.queueSize).toBe(2);

      manager.clearBatchQueue();

      expect(manager.getOptimizationStats().batching.queueSize).toBe(0);
      
      await expect(promise1).rejects.toThrow('Batch queue cleared');
      await expect(promise2).rejects.toThrow('Batch queue cleared');
    });

    it('should clear priority queue', async () => {
      const testManager = new RequestOptimizationManager(
        {},
        {},
        { maxConcurrentRequests: 0 } // Prevent execution
      );

      const promise = testManager.prioritizeRequest(
        '/api/test',
        'GET',
        undefined,
        {},
        mockExecutor
      );

      expect(testManager.getOptimizationStats().prioritization.queueSize).toBe(1);

      testManager.clearPriorityQueue();

      expect(testManager.getOptimizationStats().prioritization.queueSize).toBe(0);
      
      // The promise should be rejected due to abort
      await expect(promise).rejects.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom deduplication options', () => {
      const customManager = new RequestOptimizationManager(
        {
          enabled: false,
          maxAge: 10000,
          keyGenerator: (endpoint, method) => `custom:${method}:${endpoint}`
        }
      );

      const stats = customManager.getOptimizationStats();
      expect(stats.deduplication.enabled).toBe(false);
      expect(stats.deduplication.maxAge).toBe(10000);
    });

    it('should respect custom batching options', () => {
      const customManager = new RequestOptimizationManager(
        {},
        {
          enabled: false,
          maxBatchSize: 20,
          batchTimeout: 100,
          batchableEndpoints: ['/custom/endpoint']
        }
      );

      const stats = customManager.getOptimizationStats();
      expect(stats.batching.enabled).toBe(false);
      expect(stats.batching.maxBatchSize).toBe(20);
      expect(stats.batching.batchTimeout).toBe(100);
    });

    it('should respect custom prioritization options', () => {
      const customRules: PriorityRule[] = [
        { pattern: /\/custom\//, priority: RequestPriority.HIGH }
      ];

      const customManager = new RequestOptimizationManager(
        {},
        {},
        {
          enabled: false,
          maxConcurrentRequests: 10,
          priorityRules: customRules
        }
      );

      const stats = customManager.getOptimizationStats();
      expect(stats.prioritization.enabled).toBe(false);
      expect(stats.prioritization.maxConcurrent).toBe(10);
    });
  });
});