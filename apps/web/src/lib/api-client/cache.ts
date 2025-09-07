import { ApiResponse } from './types';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStrategy {
  type: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  maxSize: number;
  ttl: number;
  evictionPolicy: 'lru' | 'fifo' | 'ttl';
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export interface CacheManager {
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttl?: number): void;
  invalidate(pattern: string): void;
  clear(): void;
  getStats(): CacheStats;
  cleanup(): void;
}

// Memory Cache Implementation
export class MemoryCache implements CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats;
  private readonly strategy: CacheStrategy;

  constructor(strategy: Partial<CacheStrategy> = {}) {
    this.strategy = {
      type: 'memory',
      maxSize: 100 * 1024 * 1024, // 100MB
      ttl: 5 * 60 * 1000, // 5 minutes
      evictionPolicy: 'lru',
      ...strategy
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0
    };

    // Periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalEntries--;
      this.stats.totalSize -= entry.size;
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }

    // Update access info for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hitCount++;
    this.updateHitRate();
    
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const size = this.calculateSize(data);
    const entryTtl = ttl || this.strategy.ttl;
    
    // Check if we need to evict entries
    this.ensureCapacity(size);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: entryTtl,
      size,
      accessCount: 1,
      lastAccessed: Date.now()
    };

    // Remove existing entry if it exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.stats.totalSize -= existingEntry.size;
    } else {
      this.stats.totalEntries++;
    }

    this.cache.set(key, entry);
    this.stats.totalSize += size;
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];

    Array.from(this.cache.keys()).forEach(key => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.stats.totalEntries--;
      }
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
  }

  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      ...this.stats,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
    };
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.stats.totalEntries--;
      }
      this.cache.delete(key);
    }
  }

  private ensureCapacity(newEntrySize: number): void {
    while (this.stats.totalSize + newEntrySize > this.strategy.maxSize && this.cache.size > 0) {
      this.evictEntry();
    }
  }

  private evictEntry(): void {
    let keyToEvict: string | null = null;

    switch (this.strategy.evictionPolicy) {
      case 'lru':
        keyToEvict = this.findLRUKey();
        break;
      case 'fifo':
        keyToEvict = this.findFIFOKey();
        break;
      case 'ttl':
        keyToEvict = this.findTTLKey();
        break;
    }

    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.stats.totalEntries--;
        this.stats.evictionCount++;
      }
      this.cache.delete(keyToEvict);
    }
  }

  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  private findFIFOKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  private findTTLKey(): string | null {
    let keyToEvict: string | null = null;
    let shortestTTL = Infinity;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      const remainingTTL = entry.ttl - (Date.now() - entry.timestamp);
      if (remainingTTL < shortestTTL) {
        shortestTTL = remainingTTL;
        keyToEvict = key;
      }
    });

    return keyToEvict;
  }

  private calculateSize(data: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(data).length * 2; // UTF-16 characters are 2 bytes
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }
}

// LocalStorage Cache Implementation
export class LocalStorageCache implements CacheManager {
  private readonly prefix: string;
  private readonly strategy: CacheStrategy;
  private stats: CacheStats;

  constructor(prefix: string = 'api_cache_', strategy: Partial<CacheStrategy> = {}) {
    this.prefix = prefix;
    this.strategy = {
      type: 'localStorage',
      maxSize: 5 * 1024 * 1024, // 5MB
      ttl: 30 * 60 * 1000, // 30 minutes
      evictionPolicy: 'ttl',
      ...strategy
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0
    };

    this.initializeStats();
  }

  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) {
        this.stats.missCount++;
        this.updateHitRate();
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(item);
      
      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(this.prefix + key);
        this.stats.missCount++;
        this.updateHitRate();
        return null;
      }

      // Update access info
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));

      this.stats.hitCount++;
      this.updateHitRate();
      
      return entry.data;
    } catch (error) {
      console.warn('LocalStorage cache get error:', error);
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (typeof window === 'undefined') return;

    try {
      const size = this.calculateSize(data);
      const entryTtl = ttl || this.strategy.ttl;
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: entryTtl,
        size,
        accessCount: 1,
        lastAccessed: Date.now()
      };

      // Check capacity
      this.ensureCapacity(size);

      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      this.updateStats();
    } catch (error) {
      console.warn('LocalStorage cache set error:', error);
      // If quota exceeded, try to clear some space
      if (error instanceof DOMException && error.code === 22) {
        this.cleanup();
        try {
          localStorage.setItem(this.prefix + key, JSON.stringify({
            data,
            timestamp: Date.now(),
            ttl: ttl || this.strategy.ttl,
            size: this.calculateSize(data),
            accessCount: 1,
            lastAccessed: Date.now()
          }));
        } catch (retryError) {
          console.warn('LocalStorage cache retry failed:', retryError);
        }
      }
    }
  }

  invalidate(pattern: string): void {
    if (typeof window === 'undefined') return;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const cacheKey = key.substring(this.prefix.length);
        if (regex.test(cacheKey)) {
          keysToDelete.push(key);
        }
      }
    }

    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }

    this.updateStats();
  }

  clear(): void {
    if (typeof window === 'undefined') return;

    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }

    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  cleanup(): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry: CacheEntry<any> = JSON.parse(item);
            if (now - entry.timestamp > entry.ttl) {
              keysToDelete.push(key);
            }
          }
        } catch (error) {
          // Invalid entry, remove it
          keysToDelete.push(key);
        }
      }
    }

    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }

    this.updateStats();
  }

  private initializeStats(): void {
    this.updateStats();
  }

  private updateStats(): void {
    if (typeof window === 'undefined') return;

    let totalEntries = 0;
    let totalSize = 0;
    const timestamps: number[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry: CacheEntry<any> = JSON.parse(item);
            totalEntries++;
            totalSize += entry.size;
            timestamps.push(entry.timestamp);
          }
        } catch (error) {
          // Invalid entry, ignore
        }
      }
    }

    this.stats.totalEntries = totalEntries;
    this.stats.totalSize = totalSize;
    this.stats.oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : undefined;
    this.stats.newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : undefined;
  }

  private ensureCapacity(newEntrySize: number): void {
    this.updateStats();
    
    while (this.stats.totalSize + newEntrySize > this.strategy.maxSize) {
      if (!this.evictOldestEntry()) {
        break; // No more entries to evict
      }
    }
  }

  private evictOldestEntry(): boolean {
    if (typeof window === 'undefined') return false;

    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry: CacheEntry<any> = JSON.parse(item);
            if (entry.timestamp < oldestTimestamp) {
              oldestTimestamp = entry.timestamp;
              oldestKey = key;
            }
          }
        } catch (error) {
          // Invalid entry, remove it
          localStorage.removeItem(key);
          return true;
        }
      }
    }

    if (oldestKey) {
      localStorage.removeItem(oldestKey);
      this.stats.evictionCount++;
      return true;
    }

    return false;
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2;
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }
}

// Multi-tier Cache Manager
export class MultiTierCacheManager implements CacheManager {
  private memoryCache: MemoryCache;
  private persistentCache: LocalStorageCache;
  private stats: CacheStats;

  constructor(
    memoryStrategy: Partial<CacheStrategy> = {},
    persistentStrategy: Partial<CacheStrategy> = {}
  ) {
    this.memoryCache = new MemoryCache({
      maxSize: 50 * 1024 * 1024, // 50MB
      ttl: 5 * 60 * 1000, // 5 minutes
      ...memoryStrategy
    });

    this.persistentCache = new LocalStorageCache('api_cache_', {
      maxSize: 10 * 1024 * 1024, // 10MB
      ttl: 30 * 60 * 1000, // 30 minutes
      ...persistentStrategy
    });

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictionCount: 0
    };
  }

  get<T>(key: string): T | null {
    // Try memory cache first
    let data = this.memoryCache.get<T>(key);
    if (data !== null) {
      this.stats.hitCount++;
      this.updateHitRate();
      return data;
    }

    // Try persistent cache
    data = this.persistentCache.get<T>(key);
    if (data !== null) {
      // Promote to memory cache
      this.memoryCache.set(key, data, 5 * 60 * 1000); // 5 minutes in memory
      this.stats.hitCount++;
      this.updateHitRate();
      return data;
    }

    this.stats.missCount++;
    this.updateHitRate();
    return null;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Set in both caches with different TTLs
    const memoryTTL = Math.min(ttl || 5 * 60 * 1000, 5 * 60 * 1000); // Max 5 minutes in memory
    const persistentTTL = ttl || 30 * 60 * 1000; // Default 30 minutes in persistent

    this.memoryCache.set(key, data, memoryTTL);
    this.persistentCache.set(key, data, persistentTTL);
  }

  invalidate(pattern: string): void {
    this.memoryCache.invalidate(pattern);
    this.persistentCache.invalidate(pattern);
  }

  clear(): void {
    this.memoryCache.clear();
    this.persistentCache.clear();
    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;
  }

  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const persistentStats = this.persistentCache.getStats();

    return {
      totalEntries: memoryStats.totalEntries + persistentStats.totalEntries,
      totalSize: memoryStats.totalSize + persistentStats.totalSize,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate: this.stats.hitRate,
      evictionCount: memoryStats.evictionCount + persistentStats.evictionCount,
      oldestEntry: Math.min(
        memoryStats.oldestEntry || Date.now(),
        persistentStats.oldestEntry || Date.now()
      ),
      newestEntry: Math.max(
        memoryStats.newestEntry || 0,
        persistentStats.newestEntry || 0
      )
    };
  }

  cleanup(): void {
    this.memoryCache.cleanup();
    this.persistentCache.cleanup();
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  // Additional methods for multi-tier management
  getMemoryStats(): CacheStats {
    return this.memoryCache.getStats();
  }

  getPersistentStats(): CacheStats {
    return this.persistentCache.getStats();
  }

  clearMemoryCache(): void {
    this.memoryCache.clear();
  }

  clearPersistentCache(): void {
    this.persistentCache.clear();
  }
}