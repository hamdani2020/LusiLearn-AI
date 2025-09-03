import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export class RedisService {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });
    
    this.client.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.connected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.client.setEx(key, seconds, value);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async incrbyfloat(key: string, increment: number): Promise<number> {
    return await this.client.incrByFloat(key, increment);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.client.zAdd(key, { score, value: member });
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.zRange(key, start, stop);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return await this.client.expire(key, seconds);
  }

  async sadd(key: string, member: string): Promise<number> {
    return await this.client.sAdd(key, member);
  }

  async scard(key: string): Promise<number> {
    return await this.client.sCard(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.client.lRange(key, start, stop);
  }

  async lpush(key: string, element: string): Promise<number> {
    return await this.client.lPush(key, element);
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  isConnected(): boolean {
    return this.connected;
  }
}