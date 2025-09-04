// Cache Manager Implementation
import { CacheManager, CacheEntry } from './types';

export class HookCacheManager<T = any> implements CacheManager<T> {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private options: { defaultTTL?: number; cleanupInterval?: number } = {}) {
    this.defaultTTL = options.defaultTTL || this.defaultTTL;
    
    // Start cleanup interval
    if (options.cleanupInterval !== 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, options.cleanupInterval || 60000); // 1 minute default
    }
  }

  get<U = T>(key: string): CacheEntry<U> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp.getTime() > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Mark as stale if past stale time (half of TTL)
    const isStale = now - entry.timestamp.getTime() > entry.ttl / 2;
    return { ...entry, stale: isStale } as CacheEntry<U>;
  }

  set<U = T>(key: string, data: U, ttl?: number): void {
    const entry: CacheEntry<U> = {
      data,
      timestamp: new Date(),
      ttl: ttl || this.defaultTTL,
      stale: false
    };
    
    this.cache.set(key, entry);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  isStale(key: string): boolean {
    const entry = this.get(key);
    return entry?.stale || false;
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const isExpired = now - entry.timestamp.getTime() > entry.ttl;
      if (isExpired) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let totalEntries = 0;
    let staleEntries = 0;
    let expiredEntries = 0;

    this.cache.forEach((entry) => {
      totalEntries++;
      const age = now - entry.timestamp.getTime();
      
      if (age > entry.ttl) {
        expiredEntries++;
      } else if (age > entry.ttl / 2) {
        staleEntries++;
      }
    });

    return {
      totalEntries,
      staleEntries,
      expiredEntries,
      hitRate: 0 // Would need to track hits/misses for this
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Global cache instance
export const globalHookCache = new HookCacheManager({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000  // 1 minute
});