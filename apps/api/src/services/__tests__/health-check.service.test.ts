import { Pool } from 'pg';
import { HealthCheckService } from '../health-check.service';

// Mock fetch globally
global.fetch = jest.fn();

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;
  let mockDbPool: jest.Mocked<Pool>;
  let mockRedisClient: any;

  beforeEach(() => {
    healthCheckService = HealthCheckService.getInstance();
    
    // Mock database pool
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockDbPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      totalCount: 10,
      idleCount: 5,
      waitingCount: 0
    } as any;

    // Mock Redis client
    mockRedisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('health_check_value'),
      del: jest.fn().mockResolvedValue(1)
    };

    // Reset fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = HealthCheckService.getInstance();
      const instance2 = HealthCheckService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Database Health Check', () => {
    beforeEach(() => {
      healthCheckService.initialize(mockDbPool, mockRedisClient);
    });

    it('should return healthy status for successful database connection', async () => {
      const mockClient = await mockDbPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({
        rows: [{ health_check: 1, timestamp: new Date() }]
      });

      const result = await (healthCheckService as any).checkDatabase();

      expect(result.status).toBe('healthy');
      expect(result.details).toHaveProperty('query');
      expect(result.details).toHaveProperty('pool');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status for database connection failure', async () => {
      mockDbPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await (healthCheckService as any).checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });

    it('should return unhealthy status when database pool is not initialized', async () => {
      const uninitializedService = HealthCheckService.getInstance();
      (uninitializedService as any).dbPool = null;

      const result = await (uninitializedService as any).checkDatabase();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Database pool not initialized');
    });
  });

  describe('Redis Health Check', () => {
    beforeEach(() => {
      healthCheckService.initialize(mockDbPool, mockRedisClient);
    });

    it('should return healthy status for successful Redis operations', async () => {
      const result = await (healthCheckService as any).checkRedis();

      expect(result.status).toBe('healthy');
      expect(result.details.connectionTest).toBe('passed');
      expect(result.details.readWriteTest).toBe('passed');
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should return degraded status when Redis client is not configured', async () => {
      (healthCheckService as any).redisClient = null;

      const result = await (healthCheckService as any).checkRedis();

      expect(result.status).toBe('degraded');
      expect(result.details.message).toContain('Redis client not configured');
    });

    it('should return unhealthy status for Redis connection failure', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await (healthCheckService as any).checkRedis();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Redis connection failed');
    });
  });

  describe('AI Service Health Check', () => {
    it('should return healthy status for successful AI service response', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ status: 'healthy' })
      } as any);

      const result = await (healthCheckService as any).checkAIService();

      expect(result.status).toBe('healthy');
      expect(result.details.statusCode).toBe(200);
      expect(result.details.serviceInfo).toEqual({ status: 'healthy' });
    });

    it('should return unhealthy status for AI service connection failure', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('Connection refused'));

      const result = await (healthCheckService as any).checkAIService();

      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection refused');
    });

    it('should return degraded status for slow AI service response', async () => {
      // Mock a slow response
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: jest.fn().mockResolvedValue({ status: 'healthy' })
          } as any), 4000) // 4 second delay
        )
      );

      const result = await (healthCheckService as any).checkAIService();

      expect(result.status).toBe('degraded');
      expect(result.responseTime).toBeGreaterThan(3000);
    });
  });

  describe('External Services Health Check', () => {
    it('should return healthy status for YouTube API', async () => {
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ pageInfo: { totalResults: 1000000 } })
      } as any);

      const result = await (healthCheckService as any).checkYouTubeAPI();

      expect(result.status).toBe('healthy');
      expect(result.details.quotaUsed).toBe('available');
    });

    it('should return degraded status when YouTube API key is not configured', async () => {
      delete process.env.YOUTUBE_API_KEY;

      const result = await (healthCheckService as any).checkYouTubeAPI();

      expect(result.status).toBe('degraded');
      expect(result.details.message).toContain('YouTube API key not configured');
    });

    it('should return healthy status for Khan Academy API', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK'
      } as any);

      const result = await (healthCheckService as any).checkKhanAcademyAPI();

      expect(result.status).toBe('healthy');
      expect(result.details.statusCode).toBe(200);
    });
  });

  describe('System Health Check', () => {
    it('should return healthy status for normal system conditions', async () => {
      // Mock process.uptime to return a reasonable value
      jest.spyOn(process, 'uptime').mockReturnValue(300); // 5 minutes

      const result = await (healthCheckService as any).checkSystemHealth();

      expect(result.status).toBe('healthy');
      expect(result.details).toHaveProperty('uptime');
      expect(result.details).toHaveProperty('memory');
      expect(result.details).toHaveProperty('nodeVersion');
    });

    it('should return degraded status for high memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1GB (90% usage)
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      });

      const result = await (healthCheckService as any).checkSystemHealth();

      expect(result.status).toBe('degraded');
      expect(result.details.memory.heapUsedPercent).toBe('90%');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Full Health Check', () => {
    beforeEach(() => {
      healthCheckService.initialize(mockDbPool, mockRedisClient);
      
      // Mock all external calls to be successful
      const mockClient = {
        query: jest.fn().mockResolvedValue({
          rows: [{ health_check: 1, timestamp: new Date() }]
        }),
        release: jest.fn()
      };
      mockDbPool.connect.mockResolvedValue(mockClient as any);

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ status: 'healthy' })
      } as any);
    });

    it('should perform full health check and return overall status', async () => {
      const result = await healthCheckService.performFullHealthCheck();

      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('redis');
      expect(result.services).toHaveProperty('aiService');
      expect(result.services).toHaveProperty('externalServices');
      expect(result.services).toHaveProperty('system');
    });

    it('should determine overall health as unhealthy when database is unhealthy', async () => {
      mockDbPool.connect.mockRejectedValue(new Error('Database down'));

      const result = await healthCheckService.performFullHealthCheck();

      expect(result.overall).toBe('unhealthy');
      expect(result.services.database.status).toBe('unhealthy');
    });

    it('should determine overall health as degraded when non-critical services are down', async () => {
      // Make AI service fail
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('AI service down'));

      const result = await healthCheckService.performFullHealthCheck();

      expect(result.overall).toBe('degraded');
      expect(result.services.aiService.status).toBe('unhealthy');
    });
  });

  describe('Quick Health Check', () => {
    beforeEach(() => {
      healthCheckService.initialize(mockDbPool);
    });

    it('should return healthy status for successful quick check', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        release: jest.fn()
      };
      mockDbPool.connect.mockResolvedValue(mockClient as any);

      const result = await healthCheckService.getQuickHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result).toHaveProperty('timestamp');
    });

    it('should return unhealthy status for failed quick check', async () => {
      mockDbPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await healthCheckService.getQuickHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result).toHaveProperty('timestamp');
    });
  });
});