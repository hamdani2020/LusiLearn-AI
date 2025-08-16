import { Router, Request, Response } from 'express';
import { HealthCheckService } from '../services/health-check.service';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';
import { ErrorTrackingService } from '../middleware/error-handler';
import { MonitoringService } from '../middleware/monitoring';
import { asyncErrorHandler } from '../middleware/error-handler';
import { logger } from '../utils/logger';

export const createMonitoringRoutes = (): Router => {
  const router = Router();
  const healthCheck = HealthCheckService.getInstance();
  const performanceMonitoring = PerformanceMonitoringService.getInstance();
  const errorTracking = ErrorTrackingService.getInstance();
  const requestMonitoring = MonitoringService.getInstance();

  /**
   * GET /health - Quick health check
   */
  router.get('/health', asyncErrorHandler(async (req: Request, res: Response) => {
    const quickHealth = await healthCheck.getQuickHealthCheck();
    
    const statusCode = quickHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: quickHealth.status === 'healthy',
      data: quickHealth,
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * GET /health/detailed - Comprehensive health check
   */
  router.get('/health/detailed', asyncErrorHandler(async (req: Request, res: Response) => {
    const detailedHealth = await healthCheck.performFullHealthCheck();
    
    const statusCode = detailedHealth.overall === 'healthy' ? 200 : 
                      detailedHealth.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: detailedHealth.overall !== 'unhealthy',
      data: detailedHealth,
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * GET /metrics - Performance metrics summary
   */
  router.get('/metrics', asyncErrorHandler(async (req: Request, res: Response) => {
    const performanceSummary = performanceMonitoring.getPerformanceSummary();
    const requestMetrics = requestMonitoring.getMetricsSummary();
    const errorStats = errorTracking.getErrorStats();

    res.json({
      success: true,
      data: {
        performance: performanceSummary,
        requests: requestMetrics,
        errors: errorStats,
        timestamp: new Date().toISOString()
      }
    });
  }));

  /**
   * GET /metrics/performance - Detailed performance metrics
   */
  router.get('/metrics/performance', asyncErrorHandler(async (req: Request, res: Response) => {
    const metric = req.query.metric as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const metrics = performanceMonitoring.getMetrics(metric, limit);
    const summary = performanceMonitoring.getPerformanceSummary();

    res.json({
      success: true,
      data: {
        metrics,
        summary,
        filters: {
          metric,
          limit
        }
      },
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * GET /metrics/requests - Request monitoring metrics
   */
  router.get('/metrics/requests', asyncErrorHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    
    const metrics = requestMonitoring.getMetrics(limit);
    const summary = requestMonitoring.getMetricsSummary();

    res.json({
      success: true,
      data: {
        metrics,
        summary,
        filters: {
          limit
        }
      },
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * GET /alerts - Active performance alerts
   */
  router.get('/alerts', asyncErrorHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.active === 'true';
    const limit = parseInt(req.query.limit as string) || 50;
    
    const alerts = activeOnly 
      ? performanceMonitoring.getActiveAlerts()
      : performanceMonitoring.getAllAlerts(limit);

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        filters: {
          activeOnly,
          limit
        }
      },
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * POST /alerts/:alertId/resolve - Resolve a performance alert
   */
  router.post('/alerts/:alertId/resolve', asyncErrorHandler(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    const resolved = performanceMonitoring.resolveAlert(alertId);

    if (resolved) {
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: { alertId, resolvedAt: new Date().toISOString() }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved',
        data: { alertId }
      });
    }
  }));

  /**
   * GET /errors - Error tracking statistics
   */
  router.get('/errors', asyncErrorHandler(async (req: Request, res: Response) => {
    const errorStats = errorTracking.getErrorStats();

    res.json({
      success: true,
      data: errorStats,
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * GET /status - Overall system status dashboard
   */
  router.get('/status', asyncErrorHandler(async (req: Request, res: Response) => {
    const [healthStatus, performanceStatus, errorStats, requestStats] = await Promise.all([
      healthCheck.performFullHealthCheck(),
      performanceMonitoring.getPerformanceSummary(),
      errorTracking.getErrorStats(),
      requestMonitoring.getMetricsSummary()
    ]);

    const activeAlerts = performanceMonitoring.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');

    // Determine overall system status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthStatus.overall === 'unhealthy' || criticalAlerts.length > 0) {
      overallStatus = 'unhealthy';
    } else if (healthStatus.overall === 'degraded' || activeAlerts.length > 0 || errorStats.totalErrors > 10) {
      overallStatus = 'degraded';
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: overallStatus !== 'unhealthy',
      data: {
        overall: overallStatus,
        health: healthStatus,
        performance: performanceStatus,
        errors: errorStats,
        requests: requestStats,
        alerts: {
          active: activeAlerts.length,
          critical: criticalAlerts.length,
          recent: activeAlerts.slice(-5) // Last 5 alerts
        },
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * POST /metrics/custom - Record custom performance metric
   */
  router.post('/metrics/custom', asyncErrorHandler(async (req: Request, res: Response) => {
    const { metric, value, unit, tags } = req.body;

    if (!metric || typeof value !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric data',
        message: 'Metric name and numeric value are required'
      });
    }

    performanceMonitoring.recordMetric({
      timestamp: new Date(),
      metric,
      value,
      unit: unit || 'count',
      tags
    });

    res.json({
      success: true,
      message: 'Custom metric recorded',
      data: { metric, value, unit, tags }
    });
  }));

  /**
   * GET /logs - Recent application logs (limited)
   */
  router.get('/logs', asyncErrorHandler(async (req: Request, res: Response) => {
    const level = req.query.level as string || 'info';
    const limit = parseInt(req.query.limit as string) || 100;

    // This is a simplified implementation
    // In production, you'd integrate with your log aggregation service
    res.json({
      success: true,
      data: {
        message: 'Log endpoint available - integrate with log aggregation service',
        filters: { level, limit },
        note: 'This endpoint should be connected to your log management system (ELK, Splunk, etc.)'
      },
      timestamp: new Date().toISOString()
    });
  }));

  /**
   * POST /test/error - Test error handling (development only)
   */
  if (process.env.NODE_ENV !== 'production') {
    router.post('/test/error', asyncErrorHandler(async (req: Request, res: Response) => {
      const { type, message } = req.body;
      
      logger.warn('Test error endpoint called', { type, message, ip: req.ip });

      switch (type) {
        case 'validation':
          throw new (require('../middleware/error-handler').ValidationError)(
            message || 'Test validation error'
          );
        case 'auth':
          throw new (require('../middleware/error-handler').AuthenticationError)(
            message || 'Test authentication error'
          );
        case 'database':
          throw new (require('../middleware/error-handler').DatabaseError)(
            message || 'Test database error'
          );
        case 'external':
          throw new (require('../middleware/error-handler').ExternalServiceError)(
            message || 'Test external service error'
          );
        default:
          throw new Error(message || 'Test generic error');
      }
    }));
  }

  return router;
};