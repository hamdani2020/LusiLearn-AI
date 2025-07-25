import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CacheService } from '../cache-service';
import { redisClient } from '../redis-client';

describe('CacheService', () => {
  beforeAll(async () => {
    // Connect to Redis for testing
    try {
      await redisClient.connect();
    } catch (error) {
      console.warn('Redis not available for testing, skipping cache tests');
    }
  });

  afterAll(async () => {
    // Clean up
    try {
      await redisClient.disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear test data before each test
    try {
      if (redisClient.isReady()) {
        await CacheService.flushAll();
      }
    } catch (error) {
      // Ignore if Redis is not available
    }
  });

  describe('Basic Cache Operations', () => {
    it('should set and get a value', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const key = 'test:basic';
      const value = { message: 'Hello, World!' };

      const setResult = await CacheService.set(key, value, 60);
      expect(setResult).toBe(true);

      const getValue = await CacheService.get(key);
      expect(getValue).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const value = await CacheService.get('non-existent-key');
      expect(value).toBeNull();
    });

    it('should delete a key', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const key = 'test:delete';
      const value = { data: 'test' };

      await CacheService.set(key, value);
      const deleteResult = await CacheService.del(key);
      expect(deleteResult).toBe(true);

      const getValue = await CacheService.get(key);
      expect(getValue).toBeNull();
    });

    it('should check if key exists', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const key = 'test:exists';
      const value = { data: 'test' };

      const existsBefore = await CacheService.exists(key);
      expect(existsBefore).toBe(false);

      await CacheService.set(key, value);
      const existsAfter = await CacheService.exists(key);
      expect(existsAfter).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should manage user sessions', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const sessionId = 'test-session-123';
      const sessionData = {
        userId: 'user-456',
        email: 'test@example.com',
        loginTime: new Date().toISOString(),
      };

      // Set session
      const setResult = await CacheService.setSession(sessionId, sessionData);
      expect(setResult).toBe(true);

      // Get session
      const retrievedSession = await CacheService.getSession(sessionId);
      expect(retrievedSession).toEqual(sessionData);

      // Delete session
      const deleteResult = await CacheService.deleteSession(sessionId);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const deletedSession = await CacheService.getSession(sessionId);
      expect(deletedSession).toBeNull();
    });
  });

  describe('User-specific Caching', () => {
    it('should manage user-specific cache', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const userId = 'user-789';
      const cacheKey = 'preferences';
      const userData = {
        theme: 'dark',
        language: 'en',
        notifications: true,
      };

      // Set user cache
      const setResult = await CacheService.setUserCache(userId, cacheKey, userData);
      expect(setResult).toBe(true);

      // Get user cache
      const retrievedData = await CacheService.getUserCache(userId, cacheKey);
      expect(retrievedData).toEqual(userData);

      // Invalidate all user cache
      const invalidateResult = await CacheService.invalidateUserCache(userId);
      expect(invalidateResult).toBeGreaterThan(0);

      // Verify invalidation
      const invalidatedData = await CacheService.getUserCache(userId, cacheKey);
      expect(invalidatedData).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const identifier = 'test-user';
      const windowMs = 60000; // 1 minute
      const maxRequests = 5;

      // First request
      const result1 = await CacheService.incrementRateLimit(identifier, windowMs, maxRequests);
      expect(result1.count).toBe(1);
      expect(result1.remaining).toBe(4);

      // Second request
      const result2 = await CacheService.incrementRateLimit(identifier, windowMs, maxRequests);
      expect(result2.count).toBe(2);
      expect(result2.remaining).toBe(3);
    });
  });

  describe('Temporary Data', () => {
    it('should handle temporary data with TTL', async () => {
      if (!redisClient.isReady()) {
        console.warn('Redis not available, skipping test');
        return;
      }

      const key = 'temp-data';
      const data = { temporary: true, timestamp: Date.now() };

      // Set temporary data with short TTL
      const setResult = await CacheService.setTempData(key, data, 1); // 1 second
      expect(setResult).toBe(true);

      // Get data immediately
      const immediateData = await CacheService.getTempData(key);
      expect(immediateData).toEqual(data);

      // Wait for expiration and check again
      await new Promise(resolve => setTimeout(resolve, 1100));
      const expiredData = await CacheService.getTempData(key);
      expect(expiredData).toBeNull();
    });
  });
});