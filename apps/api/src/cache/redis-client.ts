import Redis from 'redis';
import { getRedisConfig } from '@lusilearn/config';
import { logger } from '../utils/logger';

/**
 * Redis client wrapper with connection management and utilities
 */
class RedisClient {
  private client: Redis.RedisClientType;
  private static instance: RedisClient;
  private isConnected: boolean = false;

  private constructor() {
    const config = getRedisConfig();
    
    const options = {
      socket: {
        host: config.host,
        port: config.port,
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 1000);
        },
      },
      password: config.password,
      database: config.db,
    };

    this.client = Redis.createClient(options);

    // Event handlers
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
      }
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      logger.error('Failed to disconnect from Redis:', error);
      throw error;
    }
  }

  public getClient(): Redis.RedisClientType {
    return this.client;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

export const redisClient = RedisClient.getInstance();
export default redisClient;