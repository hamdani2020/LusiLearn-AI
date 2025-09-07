/**
 * Comprehensive unit tests for cache manager
 * Tests caching strategies, TTL management, and performance optimization
 */

import {
  mockTimers,
  mockLocalStorage,
  mockSessionStorage,
  measurePerformance,
  PERFORMANCE_THRESHOLDS
} from '@/lib/testing';
import { CacheManager, CacheStrategy } from '../cache-manager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let timers: ReturnType<typeof mockTimers>;
  let localStorage: ReturnType<typeof mockLocalStorage>;
  let sessionStorage: ReturnType<typeof mockSessionStorage>;

  beforeEach(() => {
    timers = mockTimers();
    localStorage = mockLocalStorage();
    sessionStorage = mockSessionStorage();
    
    // Mock global storage
    Object.defineProperty(global, 'localStorage', {
      value: localStorage,
      writable: true
    });
    
    Object.defineProperty(global, 'sessionStorage', {
      value: sessionStorage,
      writable: true
    });

    cacheManager = new CacheManager({
      type: 'memory',
      maxSize: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
      evictionPolicy: 'lru'
    });
  });

  afterEach(() => {
    timers.restore();
    cacheManager.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data correctly', () => {
      const key = 'test-key';
      const data = { id: 1, name: 'Test Data' };

      cacheManager.set(key, data);
      const retrieved = cacheManager.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent keys', () => {
      const retrieved = cacheManager.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should handle null and undefined values', () => {
      cacheManager.set('null-key', null);
      cacheManager.set('undefined-key', undefined);

      expect(cacheManager.get('null-key')).toBeNull();
      expect(cacheManager.get('undefined-key')).toBeUndefined();
    });

    it('should overwrite existing keys', () => {
      const key = 'test-key';
      const data1 = { version: 1 };
      const data2 = { version: 2 };

      cacheManager.set(key, data1);
      expect(cacheManager.get(key)).toEqual(data1);

      cacheManager.set(key, data2);
      expect(cacheManager.get(key)).toEqual(data2);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect default TTL', () => {
      const key = 'ttl-test';
      const data = { test: 'data' };

      cacheManager.set(key, data);
      expect(cacheManager.get(key)).toEqual(data);

      // Advance time beyond TTL
      timers.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

      expect(cacheManager.get(key)).toBeNull();
    });

    it('should respect custom TTL', () => {
      const key = 'custom-ttl-test';
      const data = { test: 'data' };
      const customTTL = 2000; // 2 seconds

      cacheManager.set(key, data, customTTL);
      expect(cacheManager.get(key)).toEqual(data);

      // Advance time to just before expiry
      timers.advanceTimersByTime(1500);
      expect(cacheManager.get(key)).toEqual(data);

      // Advance time beyond custom TTL
      timers.advanceTimersByTime(1000);
      expect(cacheManager.get(key)).toBeNull();
    });

    it('should handle zero TTL (no expiration)', () => {
      const key = 'no-ttl-test';
      const data = { test: 'data' };

      cacheManager.set(key, data, 0);
      
      // Advance time significantly
      timers.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours
      
      expect(cacheManager.get(key)).toEqual(data);
    });
  });

  describe('Cache Strategies', () => {
    describe('Memory Strategy', () => {
      it('should store data in memory', () => {
        const key = 'memory-test';
        const data = { type: 'memory' };

        cacheManager.set(key, data);
        expect(cacheManager.get(key)).toEqual(data);

        // Should not persist to localStorage
        expect(localStorage.getItem).not.toHaveBeenCalled();
      });
    });

    describe('LocalStorage Strategy', () => {
      beforeEach(() => {
        cacheManager = new CacheManager({
          type: 'localStorage',
          maxSize: 100,
          ttl: 5 * 60 * 1000,
          evictionPolicy: 'lru'
        });
      });

      it('should store data in localStorage', () => {
        const key = 'localstorage-test';
        const data = { type: 'localStorage' };

        cacheManager.set(key, data);
        
        expect(localStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(key),
          expect.any(String)
        );
      });

      it('should retrieve data from localStorage', () => {
        const key = 'localstorage-retrieve-test';
        const data = { type: 'localStorage' };
        const serializedData = JSON.stringify({
          data,
          timestamp: Date.now(),
          ttl: 5 * 60 * 1000
        });

        localStorage.getItem.mockReturnValue(serializedData);

        const retrieved = cacheManager.get(key);
        expect(retrieved).toEqual(data);
        expect(localStorage.getItem).toHaveBeenCalledWith(
          expect.stringContaining(key)
        );
      });

      it('should handle localStorage errors gracefully', () => {
        const key = 'localstorage-error-test';
        const data = { type: 'localStorage' };

        localStorage.setItem.mockImplementation(() => {
          throw new Error('Storage quota exceeded');
        });

        // Should not throw error
        expect(() => cacheManager.set(key, data)).not.toThrow();
        
        // Should fallback to memory storage
        expect(cacheManager.get(key)).toEqual(data);
      });
    });

    describe('SessionStorage Strategy', () => {
      beforeEach(() => {
        cacheManager = new CacheManager({
          type: 'sessionStorage',
          maxSize: 100,
          ttl: 5 * 60 * 1000,
          evictionPolicy: 'lru'
        });
      });

      it('should store data in sessionStorage', () => {
        const key = 'sessionstorage-test';
        const data = { type: 'sessionStorage' };

        cacheManager.set(key, data);
        
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining(key),
          expect.any(String)
        );
      });
    });
  });

  describe('Eviction Policies', () => {
    describe('LRU (Least Recently Used)', () => {
      beforeEach(() => {
        cacheManager = new CacheManager({
          type: 'memory',
          maxSize: 3, // Small size to trigger eviction
          ttl: 5 * 60 * 1000,
          evictionPolicy: 'lru'
        });
      });

      it('should evict least recently used items', () => {
        // Fill cache to capacity
        cacheManager.set('key1', 'data1');
        cacheManager.set('key2', 'data2');
        cacheManager.set('key3', 'data3');

        // All items should be present
        expect(cacheManager.get('key1')).toBe('data1');
        expect(cacheManager.get('key2')).toBe('data2');
        expect(cacheManager.get('key3')).toBe('data3');

        // Access key1 to make it recently used
        cacheManager.get('key1');

        // Add new item, should evict key2 (least recently used)
        cacheManager.set('key4', 'data4');

        expect(cacheManager.get('key1')).toBe('data1'); // Still present
        expect(cacheManager.get('key2')).toBeNull(); // Evicted
        expect(cacheManager.get('key3')).toBe('data3'); // Still present
        expect(cacheManager.get('key4')).toBe('data4'); // New item
      });
    });

    describe('FIFO (First In, First Out)', () => {
      beforeEach(() => {
        cacheManager = new CacheManager({
          type: 'memory',
          maxSize: 3,
          ttl: 5 * 60 * 1000,
          evictionPolicy: 'fifo'
        });
      });

      it('should evict first inserted items', () => {
        // Fill cache to capacity
        cacheManager.set('key1', 'data1');
        cacheManager.set('key2', 'data2');
        cacheManager.set('key3', 'data3');

        // Add new item, should evict key1 (first in)
        cacheManager.set('key4', 'data4');

        expect(cacheManager.get('key1')).toBeNull(); // Evicted
        expect(cacheManager.get('key2')).toBe('data2'); // Still present
        expect(cacheManager.get('key3')).toBe('data3'); // Still present
        expect(cacheManager.get('key4')).toBe('data4'); // New item
      });
    });

    describe('TTL-based Eviction', () => {
      beforeEach(() => {
        cacheManager = new CacheManager({
          type: 'memory',
          maxSize: 10,
          ttl: 5 * 60 * 1000,
          evictionPolicy: 'ttl'
        });
      });

      it('should evict expired items first', () => {
        // Add items with different TTLs
        cacheManager.set('short-ttl', 'data1', 1000); // 1 second
        cacheManager.set('long-ttl', 'data2', 10000); // 10 seconds

        // Advance time to expire short-ttl item
        timers.advanceTimersByTime(2000);

        // Trigger eviction by accessing cache
        cacheManager.get('long-ttl');

        expect(cacheManager.get('short-ttl')).toBeNull(); // Expired and evicted
        expect(cacheManager.get('long-ttl')).toBe('data2'); // Still present
      });
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache statistics', () => {
      // Perform various cache operations
      cacheManager.set('key1', 'data1');
      cacheManager.set('key2', 'data2');
      
      cacheManager.get('key1'); // Hit
      cacheManager.get('key1'); // Hit
      cacheManager.get('key3'); // Miss

      const stats = cacheManager.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.67, 2); // 2/3
      expect(stats.size).toBe(2);
    });

    it('should track evictions', () => {
      cacheManager = new CacheManager({
        type: 'memory',
        maxSize: 2,
        ttl: 5 * 60 * 1000,
        evictionPolicy: 'lru'
      });

      cacheManager.set('key1', 'data1');
      cacheManager.set('key2', 'data2');
      cacheManager.set('key3', 'data3'); // Should trigger eviction

      const stats = cacheManager.getStats();
      expect(stats.evictions).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific keys', () => {
      cacheManager.set('key1', 'data1');
      cacheManager.set('key2', 'data2');
      cacheManager.set('key3', 'data3');

      cacheManager.invalidate('key2');

      expect(cacheManager.get('key1')).toBe('data1');
      expect(cacheManager.get('key2')).toBeNull();
      expect(cacheManager.get('key3')).toBe('data3');
    });

    it('should invalidate by pattern', () => {
      cacheManager.set('user:1:profile', 'profile1');
      cacheManager.set('user:1:settings', 'settings1');
      cacheManager.set('user:2:profile', 'profile2');
      cacheManager.set('post:1:data', 'post1');

      cacheManager.invalidate('user:1:*');

      expect(cacheManager.get('user:1:profile')).toBeNull();
      expect(cacheManager.get('user:1:settings')).toBeNull();
      expect(cacheManager.get('user:2:profile')).toBe('profile2');
      expect(cacheManager.get('post:1:data')).toBe('post1');
    });

    it('should clear all cache', () => {
      cacheManager.set('key1', 'data1');
      cacheManager.set('key2', 'data2');
      cacheManager.set('key3', 'data3');

      cacheManager.clear();

      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).toBeNull();
      expect(cacheManager.get('key3')).toBeNull();

      const stats = cacheManager.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should meet cache access performance requirements', async () => {
      const key = 'performance-test';
      const data = { large: 'data'.repeat(1000) };

      cacheManager.set(key, data);

      const accessTime = await measurePerformance(() => {
        cacheManager.get(key);
      });

      expect(accessTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_ACCESS_TIME);
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`.repeat(10)
      }));

      const setTime = await measurePerformance(() => {
        largeDataset.forEach((item, index) => {
          cacheManager.set(`item-${index}`, item);
        });
      });

      const getTime = await measurePerformance(() => {
        largeDataset.forEach((_, index) => {
          cacheManager.get(`item-${index}`);
        });
      });

      // Should handle 1000 items efficiently
      expect(setTime).toBeLessThan(1000); // 1 second
      expect(getTime).toBeLessThan(500); // 0.5 seconds
    });

    it('should maintain performance under concurrent access', async () => {
      const concurrentOperations = Array.from({ length: 100 }, (_, i) => async () => {
        cacheManager.set(`concurrent-${i}`, `data-${i}`);
        return cacheManager.get(`concurrent-${i}`);
      });

      const concurrentTime = await measurePerformance(async () => {
        await Promise.all(concurrentOperations.map(op => op()));
      });

      expect(concurrentTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Management', () => {
    it('should prevent memory leaks with proper cleanup', () => {
      const initialStats = cacheManager.getStats();
      
      // Add many items
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`item-${i}`, { data: `value-${i}` });
      }

      // Clear cache
      cacheManager.clear();

      const finalStats = cacheManager.getStats();
      expect(finalStats.size).toBe(0);
      expect(finalStats.memoryUsage).toBeLessThanOrEqual(initialStats.memoryUsage);
    });

    it('should handle memory pressure gracefully', () => {
      cacheManager = new CacheManager({
        type: 'memory',
        maxSize: 10,
        ttl: 5 * 60 * 1000,
        evictionPolicy: 'lru'
      });

      // Try to add more items than max size
      for (let i = 0; i < 20; i++) {
        cacheManager.set(`item-${i}`, { data: `value-${i}` });
      }

      const stats = cacheManager.getStats();
      expect(stats.size).toBeLessThanOrEqual(10);
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', () => {
      const circularRef: any = { name: 'circular' };
      circularRef.self = circularRef;

      // Should not throw error
      expect(() => cacheManager.set('circular', circularRef)).not.toThrow();
      
      // Should return null for unserialized data
      expect(cacheManager.get('circular')).toBeNull();
    });

    it('should handle storage quota exceeded errors', () => {
      cacheManager = new CacheManager({
        type: 'localStorage',
        maxSize: 100,
        ttl: 5 * 60 * 1000,
        evictionPolicy: 'lru'
      });

      localStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const key = 'quota-test';
      const data = { test: 'data' };

      // Should not throw error
      expect(() => cacheManager.set(key, data)).not.toThrow();
      
      // Should fallback to memory storage
      expect(cacheManager.get(key)).toEqual(data);
    });

    it('should handle corrupted cache data', () => {
      cacheManager = new CacheManager({
        type: 'localStorage',
        maxSize: 100,
        ttl: 5 * 60 * 1000,
        evictionPolicy: 'lru'
      });

      // Mock corrupted data in localStorage
      localStorage.getItem.mockReturnValue('invalid-json-data');

      const key = 'corrupted-test';
      
      // Should return null for corrupted data
      expect(cacheManager.get(key)).toBeNull();
      
      // Should not throw error
      expect(() => cacheManager.get(key)).not.toThrow();
    });
  });
});