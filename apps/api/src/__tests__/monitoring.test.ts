import { logger, performanceLogger, securityLogger, aiLogger, analyticsLogger } from '../utils/logger';
import { healthMonitor } from '../middleware/monitoring';
import { AICostMonitor } from '../services/aiCostMonitor';
import { AnalyticsService } from '../services/analytics';

// Mock Redis for testing
jest.mock('../services/redis', () => ({
  RedisService: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    incr: jest.fn(),
    incrbyfloat: jest.fn(),
    zadd: jest.fn(),
    zrange: jest.fn(),
    expire: jest.fn(),
    sadd: jest.fn(),
    scard: jest.fn(),
    keys: jest.fn(),
    lrange: jest.fn(),
    lpush: jest.fn(),
    ping: jest.fn()
  }))
}));

describe('Monitoring System', () => {
  describe('Logger', () => {
    it('should log messages with structured format', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.info('Test message', { userId: 'test-user', requestId: 'test-req' });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log performance metrics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      performanceLogger.info('API Request', {
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        duration: 150,
        userId: 'test-user'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log security events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      securityLogger.info('Login attempt', {
        action: 'login',
        userId: 'test-user',
        ip: '127.0.0.1',
        success: true
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log AI usage', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      aiLogger.info('AI API Usage', {
        model: 'gpt-3.5-turbo',
        operation: 'chat_completion',
        tokens: 150,
        cost: 0.0003,
        userId: 'test-user'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log analytics events', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      analyticsLogger.info('User Analytics Event', {
        event: 'page_view',
        userId: 'test-user',
        sessionId: 'test-session',
        properties: { page: '/dashboard' }
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Health Monitor', () => {
    it('should track requests and connections', () => {
      const initialMetrics = healthMonitor.getMetrics();
      
      healthMonitor.incrementRequests();
      healthMonitor.incrementConnections();
      
      const updatedMetrics = healthMonitor.getMetrics();
      
      expect(updatedMetrics.totalRequests).toBe(initialMetrics.totalRequests + 1);
      expect(updatedMetrics.activeConnections).toBe(initialMetrics.activeConnections + 1);
    });

    it('should track errors', () => {
      const initialMetrics = healthMonitor.getMetrics();
      
      healthMonitor.incrementErrors();
      
      const updatedMetrics = healthMonitor.getMetrics();
      
      expect(updatedMetrics.errorRate).toBeGreaterThan(initialMetrics.errorRate);
    });

    it('should provide system metrics', () => {
      const metrics = healthMonitor.getMetrics();
      
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('errorRate');
    });
  });

  describe('AI Cost Monitor', () => {
    let aiCostMonitor: AICostMonitor;
    let mockRedis: any;

    beforeEach(() => {
      const { RedisService } = require('../services/redis');
      mockRedis = new RedisService();
      aiCostMonitor = new AICostMonitor(mockRedis);
    });

    it('should calculate costs correctly', async () => {
      const cost = await aiCostMonitor.recordUsage(
        'chat_completion',
        'gpt-3.5-turbo',
        1000,
        'test-user'
      );
      
      expect(cost).toBeGreaterThan(0);
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.incrbyfloat).toHaveBeenCalled();
    });

    it('should get daily cost', async () => {
      mockRedis.get.mockResolvedValue('10.50');
      
      const cost = await aiCostMonitor.getDailyCost();
      
      expect(cost).toBe(10.50);
    });

    it('should check if user is over limit', async () => {
      mockRedis.get.mockResolvedValue('15.00'); // Over $10 limit
      
      const isOverLimit = await aiCostMonitor.isUserOverLimit('test-user');
      
      expect(isOverLimit).toBe(true);
    });
  });

  describe('Analytics Service', () => {
    let analyticsService: AnalyticsService;
    let mockRedis: any;

    beforeEach(() => {
      const { RedisService } = require('../services/redis');
      mockRedis = new RedisService();
      analyticsService = new AnalyticsService(mockRedis);
    });

    it('should track user events', async () => {
      await analyticsService.trackEvent(
        'test-user',
        'test-session',
        'page_view',
        { page: '/dashboard' },
        '127.0.0.1',
        'Mozilla/5.0'
      );
      
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.sadd).toHaveBeenCalled();
    });

    it('should get user analytics', async () => {
      mockRedis.zrange.mockResolvedValue([
        JSON.stringify({
          userId: 'test-user',
          sessionId: 'test-session',
          event: 'page_view',
          timestamp: Date.now()
        })
      ]);
      mockRedis.get.mockResolvedValue(null);

      const analytics = await analyticsService.getUserAnalytics('test-user', 7);
      
      expect(analytics).toHaveProperty('totalEvents');
      expect(analytics).toHaveProperty('totalSessions');
      expect(analytics).toHaveProperty('averageSessionDuration');
      expect(analytics).toHaveProperty('topEvents');
      expect(analytics).toHaveProperty('learningMetrics');
    });

    it('should get platform analytics', async () => {
      mockRedis.scard.mockResolvedValue(100);
      mockRedis.keys.mockResolvedValue(['metrics:events:page_view:2024-01-01']);
      mockRedis.get.mockResolvedValue('50');
      mockRedis.lrange.mockResolvedValue(['85', '90', '78']);

      const analytics = await analyticsService.getPlatformAnalytics();
      
      expect(analytics).toHaveProperty('dailyActiveUsers');
      expect(analytics).toHaveProperty('totalEvents');
      expect(analytics).toHaveProperty('topEvents');
      expect(analytics).toHaveProperty('platformBreakdown');
      expect(analytics).toHaveProperty('learningMetrics');
    });
  });
});