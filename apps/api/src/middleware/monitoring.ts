import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logPerformance, logger } from '../utils/logger';

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      userId?: string;
    }
  }
}

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
    const duration = Date.now() - req.startTime;
    
    // Log performance metrics
    logPerformance(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      req.userId,
      {
        requestId: req.requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: res.get('Content-Length'),
        referer: req.get('Referer')
      }
    );

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration,
        requestId: req.requestId,
        userId: req.userId
      });
    }

    // Call original end method and return the response
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// Error monitoring middleware
export const errorMonitoringMiddleware = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const duration = Date.now() - req.startTime;
  
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    requestId: req.requestId,
    userId: req.userId,
    duration,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  next(error);
};

// Health check metrics
interface HealthMetrics {
  uptime: number;
  timestamp: number;
  memory: NodeJS.MemoryUsage;
  cpu: number;
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
}

class HealthMonitor {
  private totalRequests = 0;
  private errorCount = 0;
  private activeConnections = 0;
  private startTime = Date.now();

  incrementRequests() {
    this.totalRequests++;
  }

  incrementErrors() {
    this.errorCount++;
  }

  incrementConnections() {
    this.activeConnections++;
  }

  decrementConnections() {
    this.activeConnections--;
  }

  getMetrics(): HealthMetrics {
    return {
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      activeConnections: this.activeConnections,
      totalRequests: this.totalRequests,
      errorRate: this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0
    };
  }

  reset() {
    this.totalRequests = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }
}

export const healthMonitor = new HealthMonitor();

// Middleware to track requests and connections
export const healthTrackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  healthMonitor.incrementRequests();
  healthMonitor.incrementConnections();

  res.on('finish', () => {
    healthMonitor.decrementConnections();
    if (res.statusCode >= 400) {
      healthMonitor.incrementErrors();
    }
  });

  next();
};

// Memory usage monitoring
export const startMemoryMonitoring = () => {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    logger.info('Memory usage', { memoryUsage: memoryUsageMB });

    // Alert on high memory usage
    if (memoryUsageMB.heapUsed > 500) { // 500MB threshold
      logger.warn('High memory usage detected', { memoryUsage: memoryUsageMB });
    }
  }, 60000); // Check every minute
};

// CPU usage monitoring
export const startCPUMonitoring = () => {
  let lastCpuUsage = process.cpuUsage();
  
  setInterval(() => {
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
    
    logger.info('CPU usage', { cpuUsage: cpuPercent });

    // Alert on high CPU usage
    if (cpuPercent > 80) { // 80% threshold
      logger.warn('High CPU usage detected', { cpuUsage: cpuPercent });
    }

    lastCpuUsage = process.cpuUsage();
  }, 60000); // Check every minute
};