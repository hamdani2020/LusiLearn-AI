import { redisClient } from './redis-client';
import { logger } from '../utils/logger';

/**
 * Cache service with utilities for different caching patterns
 */
export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly SESSION_TTL = 86400; // 24 hours
  private static readonly TEMP_DATA_TTL = 1800; // 30 minutes

  /**
   * Generic cache operations
   */
  static async get<T = any>(key: string): Promise<T | null> {
    try {
      const client = redisClient.getClient();
      const value = await client.get(key);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  static async set(
    key: string,
    value: any,
    ttl: number = CacheService.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const serialized = JSON.stringify(value);
      
      await client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  static async del(key: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const result = await client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  static async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const result = await client.expire(key, ttl);
      return result;
    } catch (error) {
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  static async ttl(key: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      return await client.ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', { key, error });
      return -1;
    }
  }

  /**
   * Session management
   */
  static async setSession(
    sessionId: string,
    sessionData: any,
    ttl: number = CacheService.SESSION_TTL
  ): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.set(key, sessionData, ttl);
  }

  static async getSession<T = any>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return this.get<T>(key);
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.del(key);
  }

  static async refreshSession(
    sessionId: string,
    ttl: number = CacheService.SESSION_TTL
  ): Promise<boolean> {
    const key = `session:${sessionId}`;
    return this.expire(key, ttl);
  }

  /**
   * User-specific caching
   */
  static async setUserCache(
    userId: string,
    cacheKey: string,
    data: any,
    ttl: number = CacheService.DEFAULT_TTL
  ): Promise<boolean> {
    const key = `user:${userId}:${cacheKey}`;
    return this.set(key, data, ttl);
  }

  static async getUserCache<T = any>(
    userId: string,
    cacheKey: string
  ): Promise<T | null> {
    const key = `user:${userId}:${cacheKey}`;
    return this.get<T>(key);
  }

  static async deleteUserCache(
    userId: string,
    cacheKey: string
  ): Promise<boolean> {
    const key = `user:${userId}:${cacheKey}`;
    return this.del(key);
  }

  static async invalidateUserCache(userId: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      const pattern = `user:${userId}:*`;
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      return await client.del(keys);
    } catch (error) {
      logger.error('User cache invalidation error:', { userId, error });
      return 0;
    }
  }

  /**
   * Content recommendations caching
   */
  static async setRecommendations(
    userId: string,
    recommendations: any[],
    ttl: number = CacheService.TEMP_DATA_TTL
  ): Promise<boolean> {
    const key = `recommendations:${userId}`;
    return this.set(key, recommendations, ttl);
  }

  static async getRecommendations(userId: string): Promise<any[] | null> {
    const key = `recommendations:${userId}`;
    return this.get<any[]>(key);
  }

  /**
   * Learning path caching
   */
  static async setLearningPath(
    pathId: string,
    pathData: any,
    ttl: number = CacheService.DEFAULT_TTL
  ): Promise<boolean> {
    const key = `learning_path:${pathId}`;
    return this.set(key, pathData, ttl);
  }

  static async getLearningPath(pathId: string): Promise<any | null> {
    const key = `learning_path:${pathId}`;
    return this.get(key);
  }

  static async invalidateLearningPath(pathId: string): Promise<boolean> {
    const key = `learning_path:${pathId}`;
    return this.del(key);
  }

  /**
   * Rate limiting
   */
  static async incrementRateLimit(
    identifier: string,
    windowMs: number = 900000, // 15 minutes
    maxRequests: number = 100
  ): Promise<{ count: number; remaining: number; resetTime: number }> {
    try {
      const client = redisClient.getClient();
      const key = `rate_limit:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use Redis pipeline for atomic operations
      const pipeline = client.multi();
      
      // Remove old entries
      pipeline.zRemRangeByScore(key, 0, windowStart);
      
      // Add current request
      pipeline.zAdd(key, { score: now, value: now.toString() });
      
      // Get current count
      pipeline.zCard(key);
      
      // Set expiration
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      const count = results[2] as number;

      const remaining = Math.max(0, maxRequests - count);
      const resetTime = now + windowMs;

      return { count, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit error:', { identifier, error });
      // Return safe defaults on error
      return { count: 0, remaining: maxRequests, resetTime: Date.now() + windowMs };
    }
  }

  /**
   * Temporary data storage
   */
  static async setTempData(
    key: string,
    data: any,
    ttl: number = CacheService.TEMP_DATA_TTL
  ): Promise<boolean> {
    const tempKey = `temp:${key}`;
    return this.set(tempKey, data, ttl);
  }

  static async getTempData<T = any>(key: string): Promise<T | null> {
    const tempKey = `temp:${key}`;
    return this.get<T>(tempKey);
  }

  static async deleteTempData(key: string): Promise<boolean> {
    const tempKey = `temp:${key}`;
    return this.del(tempKey);
  }

  /**
   * Pub/Sub for real-time updates
   */
  static async publish(channel: string, message: any): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const serialized = JSON.stringify(message);
      await client.publish(channel, serialized);
      return true;
    } catch (error) {
      logger.error('Publish error:', { channel, error });
      return false;
    }
  }

  static async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          logger.error('Message parse error:', { channel, message, error });
        }
      });
    } catch (error) {
      logger.error('Subscribe error:', { channel, error });
      throw error;
    }
  }

  /**
   * Cache invalidation strategies
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      return await client.del(keys);
    } catch (error) {
      logger.error('Pattern invalidation error:', { pattern, error });
      return 0;
    }
  }

  static async flushAll(): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      await client.flushAll();
      return true;
    } catch (error) {
      logger.error('Flush all error:', error);
      return false;
    }
  }

  /**
   * Cache statistics
   */
  static async getStats(): Promise<{
    connected: boolean;
    memory: any;
    keyspace: any;
  }> {
    try {
      const client = redisClient.getClient();
      const info = await client.info();
      
      // Parse Redis INFO response
      const lines = info.split('\r\n');
      const stats: any = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      return {
        connected: redisClient.isReady(),
        memory: {
          used: stats.used_memory_human,
          peak: stats.used_memory_peak_human,
          rss: stats.used_memory_rss_human,
        },
        keyspace: {
          keys: stats.db0 || '0',
          expires: stats.db0 || '0',
        },
      };
    } catch (error) {
      logger.error('Stats error:', error);
      return {
        connected: false,
        memory: {},
        keyspace: {},
      };
    }
  }
}

export default CacheService;