import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface RequestMetrics {
  requestId: string;
  method: string;
  url: string;
  path: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  apiVersion?: string;
  timestamp: string;
  responseSize?: number;
  errorCode?: string;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 10000; // Keep last 10k requests in memory

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  public addMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  public getMetrics(limit: number = 100): RequestMetrics[] {
    return this.metrics.slice(-limit);
  }

  public getMetricsSummary(): any {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > oneHourAgo
    );

    const statusCodes = recentMetrics.reduce((acc, metric) => {
      const code = metric.statusCode || 0;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const avgDuration = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / recentMetrics.length
      : 0;

    const errorRate = recentMetrics.length > 0
      ? (recentMetrics.filter(m => (m.statusCode || 0) >= 400).length / recentMetrics.length) * 100
      : 0;

    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: Math.round(avgDuration),
      errorRate: Math.round(errorRate * 100) / 100,
      statusCodeDistribution: statusCodes,
      timeWindow: '1 hour',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced monitoring middleware that tracks detailed request/response metrics
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const monitoring = MonitoringService.getInstance();

  // Add request ID to request for tracking
  (req as any).requestId = requestId;
  (req as any).startTime = startTime;

  // Create initial metric
  const metric: RequestMetrics = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    apiVersion: (req as any).apiVersion,
    timestamp: new Date().toISOString()
  };

  // Add user ID if available (from auth middleware)
  if ((req as any).user?.id) {
    metric.userId = (req as any).user.id;
  }

  // Override res.end to capture final metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Update metric with response data
    metric.statusCode = res.statusCode;
    metric.duration = duration;
    
    if (chunk) {
      metric.responseSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
    }

    // Add error code if it's an error response
    if (res.statusCode >= 400) {
      metric.errorCode = res.get('X-Error-Code') || `HTTP_${res.statusCode}`;
    }

    // Store the metric
    monitoring.addMetric(metric);

    // Log performance warnings
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }

    // Log error responses
    if (res.statusCode >= 400) {
      logger.error('Error response', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Security monitoring middleware to detect suspicious activities
 */
export const securityMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union\s+select/gi, // SQL injection
    /javascript:/gi, // JavaScript injection
    /eval\(/gi, // Code injection
  ];

  const requestData = JSON.stringify({
    url: req.url,
    query: req.query,
    body: req.body,
    headers: req.headers
  });

  const suspiciousActivity = suspiciousPatterns.some(pattern => 
    pattern.test(requestData)
  );

  if (suspiciousActivity) {
    logger.warn('Suspicious request detected', {
      requestId: (req as any).requestId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Add security headers
    res.set('X-Security-Alert', 'Suspicious activity detected');
  }

  // Rate limiting per IP
  const clientIP = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  // Simple in-memory rate limiting (in production, use Redis)
  if (!(global as any).rateLimitStore) {
    (global as any).rateLimitStore = new Map();
  }

  const requests = (global as any).rateLimitStore.get(clientIP) || [];
  const recentRequests = requests.filter((timestamp: number) => now - timestamp < windowMs);
  
  if (recentRequests.length > 100) { // 100 requests per minute
    logger.warn('Rate limit exceeded', {
      ip: clientIP,
      requestCount: recentRequests.length,
      timeWindow: '1 minute'
    });
    
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests from this IP address',
      retryAfter: 60
    });
  }

  recentRequests.push(now);
  (global as any).rateLimitStore.set(clientIP, recentRequests);

  next();
};

/**
 * API metrics endpoint middleware
 */
export const createMetricsEndpoint = () => {
  return (req: Request, res: Response) => {
    const monitoring = MonitoringService.getInstance();
    const summary = monitoring.getMetricsSummary();
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });
  };
};

/**
 * Detailed metrics endpoint for debugging
 */
export const createDetailedMetricsEndpoint = () => {
  return (req: Request, res: Response) => {
    const monitoring = MonitoringService.getInstance();
    const limit = parseInt(req.query.limit as string) || 100;
    const metrics = monitoring.getMetrics(limit);
    
    res.json({
      success: true,
      data: {
        metrics,
        total: metrics.length,
        summary: monitoring.getMetricsSummary()
      },
      timestamp: new Date().toISOString()
    });
  };
};