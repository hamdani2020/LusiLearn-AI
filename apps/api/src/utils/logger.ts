import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logLevel = process.env.LOG_LEVEL || 'info';
const serviceName = process.env.SERVICE_NAME || 'lusilearn-api';
const environment = process.env.NODE_ENV || 'development';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, requestId, duration, ...meta } = info;
    const logEntry = {
      timestamp,
      level,
      service,
      environment,
      message,
      ...(userId ? { userId } : {}),
      ...(requestId ? { requestId } : {}),
      ...(duration ? { duration } : {}),
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Performance logging format
const performanceFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, method, url, statusCode, duration, userId, ...meta } = info;
    const logEntry = {
      timestamp,
      level,
      service,
      environment,
      type: 'performance',
      method,
      url,
      statusCode,
      duration,
      ...(userId ? { userId } : {}),
      message,
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Security logging format
const securityFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, userId, ip, userAgent, action, ...meta } = info;
    const logEntry = {
      timestamp,
      level,
      service,
      environment,
      type: 'security',
      userId,
      ip,
      userAgent,
      action,
      message,
      ...meta
    };
    return JSON.stringify(logEntry);
  })
);

// Main application logger
export const logger = winston.createLogger({
  level: logLevel,
  format: structuredFormat,
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    }),
  ],
});

// Performance logger for API metrics
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: performanceFormat,
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 5,
      tailable: true
    }),
  ],
});

// Security logger for authentication and authorization events
export const securityLogger = winston.createLogger({
  level: 'info',
  format: securityFormat,
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'security.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    }),
  ],
});

// AI cost and usage logger
export const aiLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf((info) => {
      const { timestamp, level, message, service, userId, model, tokens, cost, operation, ...meta } = info;
      const logEntry = {
        timestamp,
        level,
        service,
        environment,
        type: 'ai_usage',
        userId,
        model,
        tokens,
        cost,
        operation,
        message,
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'ai-usage.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5,
      tailable: true
    }),
  ],
});

// User analytics logger
export const analyticsLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf((info) => {
      const { timestamp, level, message, service, userId, sessionId, event, properties, ...meta } = info;
      const logEntry = {
        timestamp,
        level,
        service,
        environment,
        type: 'analytics',
        userId,
        sessionId,
        event,
        properties,
        message,
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  defaultMeta: { service: serviceName },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'analytics.log'),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 10,
      tailable: true
    }),
  ],
});

// Console logging for development
if (environment !== 'production') {
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((info) => {
        const { timestamp, level, message, service, userId, requestId, ...meta } = info;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const userStr = userId ? ` [User: ${userId}]` : '';
        const reqStr = requestId ? ` [Req: ${(requestId as string).slice(0, 8)}]` : '';
        return `${timestamp} [${service}] ${level}:${userStr}${reqStr} ${message}${metaStr}`;
      })
    )
  });

  logger.add(consoleTransport);
  performanceLogger.add(consoleTransport);
  securityLogger.add(consoleTransport);
  aiLogger.add(consoleTransport);
  analyticsLogger.add(consoleTransport);
}

// Helper functions for structured logging
export const logWithContext = (level: string, message: string, context: Record<string, any> = {}) => {
  logger.log(level, message, context);
};

export const logPerformance = (method: string, url: string, statusCode: number, duration: number, userId?: string, additionalData?: Record<string, any>) => {
  performanceLogger.info('API Request', {
    method,
    url,
    statusCode,
    duration,
    userId,
    ...additionalData
  });
};

export const logSecurity = (action: string, userId: string, ip: string, userAgent: string, success: boolean, additionalData?: Record<string, any>) => {
  const level = success ? 'info' : 'warn';
  securityLogger.log(level, `Security event: ${action}`, {
    action,
    userId,
    ip,
    userAgent,
    success,
    ...additionalData
  });
};

export const logAIUsage = (operation: string, model: string, tokens: number, cost: number, userId?: string, additionalData?: Record<string, any>) => {
  aiLogger.info('AI API Usage', {
    operation,
    model,
    tokens,
    cost,
    userId,
    ...additionalData
  });
};

export const logAnalytics = (event: string, userId: string, sessionId: string, properties: Record<string, any> = {}) => {
  analyticsLogger.info('User Analytics Event', {
    event,
    userId,
    sessionId,
    properties
  });
};

export default logger;