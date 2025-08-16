import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ErrorTrackingService } from '../middleware/error-handler';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTime: number;
  details?: any;
  error?: string;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    aiService: HealthCheckResult;
    externalServices: {
      youtube: HealthCheckResult;
      khanAcademy: HealthCheckResult;
    };
    system: HealthCheckResult;
  };
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    errorRate: number;
    responseTime: number;
  };
  timestamp: string;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private dbPool?: Pool;
  private redisClient?: any;
  private startTime: number = Date.now();

  private constructor() {}

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  public initialize(dbPool: Pool, redisClient?: any): void {
    this.dbPool = dbPool;
    this.redisClient = redisClient;
  }

  public async performFullHealthCheck(): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    
    try {
      const [
        databaseHealth,
        redisHealth,
        aiServiceHealth,
        youtubeHealth,
        khanAcademyHealth,
        systemHealth
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkAIService(),
        this.checkYouTubeAPI(),
        this.checkKhanAcademyAPI(),
        this.checkSystemHealth()
      ]);

      const services = {
        database: this.getResultFromSettled(databaseHealth),
        redis: this.getResultFromSettled(redisHealth),
        aiService: this.getResultFromSettled(aiServiceHealth),
        externalServices: {
          youtube: this.getResultFromSettled(youtubeHealth),
          khanAcademy: this.getResultFromSettled(khanAcademyHealth)
        },
        system: this.getResultFromSettled(systemHealth)
      };

      const overall = this.determineOverallHealth(services);
      const metrics = await this.getSystemMetrics();
      const responseTime = Date.now() - startTime;

      return {
        overall,
        services,
        metrics: {
          ...metrics,
          responseTime
        },
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      logger.error('Health check failed', { error: error.message });
      
      return {
        overall: 'unhealthy',
        services: {
          database: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' },
          redis: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' },
          aiService: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' },
          externalServices: {
            youtube: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' },
            khanAcademy: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' }
          },
          system: { status: 'unhealthy', timestamp: new Date().toISOString(), responseTime: 0, error: 'Health check failed' }
        },
        metrics: {
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage(),
          cpuUsage: 0,
          errorRate: 0,
          responseTime: Date.now() - startTime
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      if (!this.dbPool) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          error: 'Database pool not initialized'
        };
      }

      // Test basic connectivity
      const client = await this.dbPool.connect();
      const result = await client.query('SELECT 1 as health_check, NOW() as timestamp');
      client.release();

      // Test connection pool status
      const poolStatus = {
        totalCount: this.dbPool.totalCount,
        idleCount: this.dbPool.idleCount,
        waitingCount: this.dbPool.waitingCount
      };

      const responseTime = Date.now() - startTime;
      const isHealthy = result.rows.length > 0 && responseTime < 5000; // 5 second threshold

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          query: result.rows[0],
          pool: poolStatus,
          connectionTest: 'passed'
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connectionTest: 'failed'
        }
      };
    }
  }

  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      if (!this.redisClient) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          details: {
            message: 'Redis client not configured - caching disabled'
          }
        };
      }

      // Test Redis connectivity
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'health_check_value';
      
      await this.redisClient.set(testKey, testValue, 'EX', 10); // Expire in 10 seconds
      const retrievedValue = await this.redisClient.get(testKey);
      await this.redisClient.del(testKey);

      const responseTime = Date.now() - startTime;
      const isHealthy = retrievedValue === testValue && responseTime < 2000; // 2 second threshold

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          connectionTest: 'passed',
          readWriteTest: retrievedValue === testValue ? 'passed' : 'failed'
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connectionTest: 'failed'
        }
      };
    }
  }

  private async checkAIService(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8001';
      
      const response = await fetch(`${aiServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < 3000; // 3 second threshold

      let details: any = {
        statusCode: response.status,
        statusText: response.statusText
      };

      if (response.ok) {
        try {
          const data = await response.json();
          details.serviceInfo = data;
        } catch {
          // Response might not be JSON
        }
      }

      return {
        status: isHealthy ? 'healthy' : response.ok ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime,
        details
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message,
        details: {
          connectionTest: 'failed'
        }
      };
    }
  }

  private async checkYouTubeAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      if (!apiKey) {
        return {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          details: {
            message: 'YouTube API key not configured'
          }
        };
      }

      // Simple quota check - search for a common term
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=education&maxResults=1&key=${apiKey}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        }
      );

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < 3000;

      let details: any = {
        statusCode: response.status,
        statusText: response.statusText
      };

      if (response.ok) {
        const data = await response.json();
        details.quotaUsed = data.pageInfo ? 'available' : 'unknown';
      }

      return {
        status: isHealthy ? 'healthy' : response.status === 403 ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime,
        details
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async checkKhanAcademyAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Khan Academy API doesn't require authentication for basic content access
      const response = await fetch(
        'https://www.khanacademy.org/api/v1/topic/math',
        {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        }
      );

      const responseTime = Date.now() - startTime;
      const isHealthy = response.ok && responseTime < 3000;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async checkSystemHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Check memory usage (warn if over 80% of heap limit)
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const isMemoryHealthy = heapUsedPercent < 80;
      
      // Check if process has been running for a reasonable time
      const isUptimeHealthy = uptime > 10; // At least 10 seconds
      
      const isHealthy = isMemoryHealthy && isUptimeHealthy;
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: {
          uptime: `${Math.floor(uptime)}s`,
          memory: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsedPercent: `${Math.round(heapUsedPercent)}%`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
          },
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private getResultFromSettled(settledResult: PromiseSettledResult<HealthCheckResult>): HealthCheckResult {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value;
    } else {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: 0,
        error: settledResult.reason?.message || 'Unknown error'
      };
    }
  }

  private determineOverallHealth(services: any): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalServices = [services.database, services.system];
    const allServices = [
      ...criticalServices,
      services.redis,
      services.aiService,
      services.externalServices.youtube,
      services.externalServices.khanAcademy
    ];

    // If any critical service is unhealthy, overall is unhealthy
    if (criticalServices.some(service => service.status === 'unhealthy')) {
      return 'unhealthy';
    }

    // If any service is unhealthy or multiple services are degraded, overall is degraded
    const unhealthyCount = allServices.filter(service => service.status === 'unhealthy').length;
    const degradedCount = allServices.filter(service => service.status === 'degraded').length;

    if (unhealthyCount > 0 || degradedCount > 2) {
      return 'degraded';
    }

    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  private async getSystemMetrics(): Promise<any> {
    const errorTracker = ErrorTrackingService.getInstance();
    const errorStats = errorTracker.getErrorStats();
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      uptime,
      memoryUsage,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      errorRate: errorStats.totalErrors,
      responseTime: 0 // Will be set by the caller
    };
  }

  public async getQuickHealthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      // Quick database check only
      if (this.dbPool) {
        const client = await this.dbPool.connect();
        await client.query('SELECT 1');
        client.release();
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      };
    }
  }
}