// Tests for HookCacheManager
import { HookCacheManager } from '../cache-manager';

describe('HookCacheManager', () => {
  let cacheManager: HookCacheManager<any>;

  beforeEach(() => {
    cacheManager = new HookCacheManager({
      defaultTTL: 1000, // 1 second for testing
      cleanupInterval: 0 // Disable automatic cleanup for tests
    });
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  it('should store and retrieve data', () => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';

    cacheManager.set(key, testData);
    const retrieved = cacheManager.get(key);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.data).toEqual(testData);
    expect(retrieved!.stale).toBe(false);
  });

  it('should return null for non-existent keys', () => {
    const retrieved = cacheManager.get('non-existent');
    expect(retrieved).toBeNull();
  });

  it('should mark data as stale after half TTL', (done) => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';

    cacheManager.set(key, testData, 1000); // 1 second TTL

    // Check immediately - should not be stale
    let retrieved = cacheManager.get(key);
    expect(retrieved!.stale).toBe(false);

    // Check after half TTL - should be stale
    setTimeout(() => {
      retrieved = cacheManager.get(key);
      expect(retrieved!.stale).toBe(true);
      done();
    }, 600); // 600ms > 500ms (half of 1000ms TTL)
  });

  it('should expire data after TTL', (done) => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';

    cacheManager.set(key, testData, 500); // 500ms TTL

    // Check after TTL - should be null
    setTimeout(() => {
      const retrieved = cacheManager.get(key);
      expect(retrieved).toBeNull();
      done();
    }, 600);
  });

  it('should invalidate specific keys', () => {
    const testData1 = { id: 1, name: 'Test1' };
    const testData2 = { id: 2, name: 'Test2' };

    cacheManager.set('key1', testData1);
    cacheManager.set('key2', testData2);

    cacheManager.invalidate('key1');

    expect(cacheManager.get('key1')).toBeNull();
    expect(cacheManager.get('key2')).not.toBeNull();
  });

  it('should clear all data', () => {
    const testData1 = { id: 1, name: 'Test1' };
    const testData2 = { id: 2, name: 'Test2' };

    cacheManager.set('key1', testData1);
    cacheManager.set('key2', testData2);

    cacheManager.clear();

    expect(cacheManager.get('key1')).toBeNull();
    expect(cacheManager.get('key2')).toBeNull();
  });

  it('should check if data is stale', () => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';

    cacheManager.set(key, testData, 1000);

    // Initially not stale
    expect(cacheManager.isStale(key)).toBe(false);

    // Manually mark as stale by setting old timestamp
    const entry = (cacheManager as any).cache.get(key);
    entry.timestamp = new Date(Date.now() - 600); // 600ms ago

    expect(cacheManager.isStale(key)).toBe(true);
  });

  it('should cleanup expired entries', () => {
    const testData1 = { id: 1, name: 'Test1' };
    const testData2 = { id: 2, name: 'Test2' };

    cacheManager.set('key1', testData1, 100); // Short TTL
    cacheManager.set('key2', testData2, 10000); // Long TTL

    // Wait for first entry to expire
    setTimeout(() => {
      cacheManager.cleanup();

      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).not.toBeNull();
    }, 150);
  });

  it('should provide cache statistics', () => {
    const testData1 = { id: 1, name: 'Test1' };
    const testData2 = { id: 2, name: 'Test2' };

    cacheManager.set('key1', testData1);
    cacheManager.set('key2', testData2);

    const stats = cacheManager.getStats();

    expect(stats.totalEntries).toBe(2);
    expect(stats.staleEntries).toBe(0);
    expect(stats.expiredEntries).toBe(0);
  });

  it('should use custom TTL when provided', () => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';
    const customTTL = 2000;

    cacheManager.set(key, testData, customTTL);
    const retrieved = cacheManager.get(key);

    expect(retrieved!.ttl).toBe(customTTL);
  });

  it('should use default TTL when not provided', () => {
    const testData = { id: 1, name: 'Test' };
    const key = 'test-key';

    cacheManager.set(key, testData);
    const retrieved = cacheManager.get(key);

    expect(retrieved!.ttl).toBe(1000); // Default TTL from constructor
  });
});