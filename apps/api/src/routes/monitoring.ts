import { Router, Request, Response } from 'express';
import { healthMonitor } from '../middleware/monitoring';
import { AICostMonitor } from '../services/aiCostMonitor';
import { AnalyticsService } from '../services/analytics';
import { RedisService } from '../services/redis';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/database';

const router = Router();

// Initialize services (these would typically be injected via DI)
let aiCostMonitor: AICostMonitor;
let analyticsService: AnalyticsService;
let redisService: RedisService;
let databaseService: DatabaseService;

// Initialize services
const initializeServices = async () => {
  try {
    redisService = new RedisService();
    await redisService.connect();
    
    aiCostMonitor = new AICostMonitor(redisService);
    analyticsService = new AnalyticsService(redisService);
    databaseService = new DatabaseService();
  } catch (error) {
    logger.error('Failed to initialize monitoring services', { error: error.message });
  }
};

// Initialize on module load
initializeServices();

/**
 * Basic health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Detailed health check with dependencies
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  const checks = {
    api: { status: 'healthy', responseTime: 0 },
    database: { status: 'unknown', responseTime: 0 },
    redis: { status: 'unknown', responseTime: 0 },
    aiService: { status: 'unknown', responseTime: 0 }
  };

  let overallStatus = 'healthy';

  try {
    // Check database
    const dbStart = Date.now();
    try {
      if (databaseService) {
        await databaseService.query('SELECT 1');
        checks.database = { status: 'healthy', responseTime: Date.now() - dbStart };
      }
    } catch (error) {
      checks.database = { status: 'unhealthy', responseTime: Date.now() - dbStart };
      overallStatus = 'degraded';
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      if (redisService) {
        await redisService.ping();
        checks.redis = { status: 'healthy', responseTime: Date.now() - redisStart };
      }
    } catch (error) {
      checks.redis = { status: 'unhealthy', responseTime: Date.now() - redisStart };
      overallStatus = 'degraded';
    }

    // Check AI Service
    const aiStart = Date.now();
    try {
      // This would be a simple ping to the AI service
      // For now, we'll just check if the service URL is configured
      if (process.env.AI_SERVICE_URL) {
        checks.aiService = { status: 'healthy', responseTime: Date.now() - aiStart };
      } else {
        checks.aiService = { status: 'not_configured', responseTime: 0 };
      }
    } catch (error) {
      checks.aiService = { status: 'unhealthy', responseTime: Date.now() - aiStart };
      overallStatus = 'degraded';
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      metrics: healthMonitor.getMetrics()
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks
    });
  }
});

/**
 * System metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      system: healthMonitor.getMetrics(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * AI cost monitoring endpoint
 */
router.get('/ai-costs', async (req: Request, res: Response) => {
  try {
    if (!aiCostMonitor) {
      return res.status(503).json({ error: 'AI cost monitor not available' });
    }

    const period = req.query.period as 'daily' | 'monthly' || 'daily';
    const [dailyCost, monthlyCost, usageStats] = await Promise.all([
      aiCostMonitor.getDailyCost(),
      aiCostMonitor.getMonthlyCost(),
      aiCostMonitor.getUsageStats(period)
    ]);

    const response = {
      costs: {
        daily: dailyCost,
        monthly: monthlyCost
      },
      usage: usageStats,
      budgets: {
        daily: parseFloat(process.env.AI_DAILY_BUDGET || '100'),
        monthly: parseFloat(process.env.AI_MONTHLY_BUDGET || '2000')
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to get AI costs', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve AI costs' });
  }
});

/**
 * User analytics endpoint
 */
router.get('/analytics/user/:userId', async (req: Request, res: Response) => {
  try {
    if (!analyticsService) {
      return res.status(503).json({ error: 'Analytics service not available' });
    }

    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const analytics = await analyticsService.getUserAnalytics(userId, days);
    
    res.status(200).json({
      userId,
      period: `${days} days`,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get user analytics', { error: error.message, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to retrieve user analytics' });
  }
});

/**
 * Platform analytics endpoint
 */
router.get('/analytics/platform', async (req: Request, res: Response) => {
  try {
    if (!analyticsService) {
      return res.status(503).json({ error: 'Analytics service not available' });
    }

    const date = req.query.date as string;
    const analytics = await analyticsService.getPlatformAnalytics(date);
    
    res.status(200).json({
      date: date || new Date().toISOString().split('T')[0],
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get platform analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve platform analytics' });
  }
});

/**
 * Log levels endpoint (for dynamic log level changes)
 */
router.get('/logs/level', (req: Request, res: Response) => {
  res.status(200).json({
    currentLevel: logger.level,
    availableLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
  });
});

router.post('/logs/level', (req: Request, res: Response) => {
  const { level } = req.body;
  
  if (!level || !['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'].includes(level)) {
    return res.status(400).json({ error: 'Invalid log level' });
  }

  logger.level = level;
  logger.info('Log level changed', { newLevel: level, changedBy: req.userId || 'system' });
  
  res.status(200).json({
    message: 'Log level updated successfully',
    newLevel: level
  });
});

/**
 * Reset health monitor stats
 */
router.post('/metrics/reset', (req: Request, res: Response) => {
  try {
    healthMonitor.reset();
    logger.info('Health monitor metrics reset', { resetBy: req.userId || 'system' });
    
    res.status(200).json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to reset metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

export default router;