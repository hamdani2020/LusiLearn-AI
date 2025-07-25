export { redisClient } from './redis-client';
export { CacheService } from './cache-service';
export {
  cacheMiddleware,
  userCacheMiddleware,
  cacheInvalidationMiddleware,
  rateLimitMiddleware,
} from './cache-middleware';

export type { CacheOptions } from './cache-middleware';