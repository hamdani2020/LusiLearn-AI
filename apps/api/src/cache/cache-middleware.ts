import { Request, Response, NextFunction } from 'express';
import { CacheService } from './cache-service';
import { logger } from '../utils/logger';

/**
 * Express middleware for HTTP response caching
 */

export interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  skipCache?: (req: Request) => boolean;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = defaultKeyGenerator,
    condition = defaultCondition,
    skipCache = defaultSkipCache,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for certain conditions
    if (skipCache(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Try to get cached response
      const cachedResponse = await CacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug('Cache hit', { key: cacheKey });
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        // Send cached response
        return res.json(cachedResponse);
      }

      logger.debug('Cache miss', { key: cacheKey });
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        // Only cache successful responses
        if (condition(req, res)) {
          CacheService.set(cacheKey, body, ttl).catch(error => {
            logger.error('Failed to cache response:', { key: cacheKey, error });
          });
        }
        
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', { key: cacheKey, error });
      next();
    }
  };
}

/**
 * Default key generator - creates cache key from URL and query params
 */
function defaultKeyGenerator(req: Request): string {
  const userId = (req as any).user?.id || 'anonymous';
  const url = req.originalUrl || req.url;
  return `http_cache:${userId}:${url}`;
}

/**
 * Default condition - cache successful GET requests
 */
function defaultCondition(req: Request, res: Response): boolean {
  return req.method === 'GET' && res.statusCode >= 200 && res.statusCode < 300;
}

/**
 * Default skip condition - skip for authenticated POST/PUT/DELETE requests
 */
function defaultSkipCache(req: Request): boolean {
  const method = req.method;
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
}

/**
 * User-specific cache middleware
 */
export function userCacheMiddleware(cacheKey: string, ttl: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return next();
    }

    try {
      const cachedData = await CacheService.getUserCache(userId, cacheKey);
      
      if (cachedData) {
        logger.debug('User cache hit', { userId, cacheKey });
        res.set('X-Cache', 'HIT');
        return res.json({ data: cachedData });
      }

      logger.debug('User cache miss', { userId, cacheKey });
      res.set('X-Cache', 'MISS');

      // Store original send method
      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300 && body.data) {
          CacheService.setUserCache(userId, cacheKey, body.data, ttl).catch(error => {
            logger.error('Failed to cache user data:', { userId, cacheKey, error });
          });
        }
        
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('User cache middleware error:', { userId, cacheKey, error });
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function cacheInvalidationMiddleware(patterns: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      // Invalidate cache patterns on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          CacheService.invalidatePattern(pattern).catch(error => {
            logger.error('Failed to invalidate cache pattern:', { pattern, error });
          });
        });
      }
      
      return originalJson(body);
    };

    next();
  };
}

/**
 * Rate limiting middleware using Redis
 */
export function rateLimitMiddleware(
  windowMs: number = 900000, // 15 minutes
  maxRequests: number = 100,
  keyGenerator?: (req: Request) => string
) {
  const getKey = keyGenerator || ((req: Request) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = getKey(req);
      const { count, remaining, resetTime } = await CacheService.incrementRateLimit(
        identifier,
        windowMs,
        maxRequests
      );

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      });

      if (count > maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error:', error);
      next(); // Continue on error to avoid blocking requests
    }
  };
}

export default {
  cacheMiddleware,
  userCacheMiddleware,
  cacheInvalidationMiddleware,
  rateLimitMiddleware,
};