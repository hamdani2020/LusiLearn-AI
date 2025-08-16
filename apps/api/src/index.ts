import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import { logger } from './utils/logger';
import { db } from './database/connection';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { assessmentRouter } from './routes/assessment';
import { learningPathRouter, initializeLearningPathRoutes } from './routes/learning-path';
import { createProgressRoutes } from './routes/progress.routes';
import { createAdaptiveDifficultyRoutes } from './routes/adaptive-difficulty.routes';
import { createCollaborationRoutes } from './routes';
import { createSafetyModerationRoutes } from './routes/safety-moderation.routes';
import { errorHandler, setupGlobalErrorHandlers } from './middleware/error-handler';
import { monitoringMiddleware, securityMonitoringMiddleware, createMetricsEndpoint, createDetailedMetricsEndpoint } from './middleware/monitoring';
import { HealthCheckService } from './services/health-check.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { createMonitoringRoutes } from './routes/monitoring.routes';
import { setupSecurityMiddleware, authRateLimit, apiRateLimit } from './middleware/security';
import { APIGateway, GatewayConfig, RouteConfig } from './gateway/api-gateway';
import { WebSocketService } from './services/websocket.service';
import { CollaborationService } from './services/collaboration.service';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Setup comprehensive security middleware
setupSecurityMiddleware(app, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  https: {
    enforceHttps: process.env.NODE_ENV === 'production',
    trustProxy: true,
  },
});

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Monitoring middleware (after security, before routes)
app.use(monitoringMiddleware);
app.use(securityMonitoringMiddleware);

// Setup global error handlers
setupGlobalErrorHandlers();

// Initialize services
const collaborationService = new CollaborationService(db.getPool());
const webSocketService = new WebSocketService(httpServer, db.getPool(), collaborationService);

// Initialize monitoring services
const healthCheckService = HealthCheckService.getInstance();
const performanceMonitoringService = PerformanceMonitoringService.getInstance();

// Initialize health check service with database pool
healthCheckService.initialize(db.getPool());

// Initialize learning path routes with database pool
initializeLearningPathRoutes(db.getPool());

// Configure API Gateway
const gatewayConfig: GatewayConfig = {
  basePath: '/api',
  defaultVersion: 'v1',
  supportedVersions: ['v1', 'v2'], // v2 for future use
  enableRequestLogging: true,
  enableResponseLogging: true
};

const apiGateway = new APIGateway(app, gatewayConfig);

// Setup health check with custom health function
apiGateway.setupHealthCheck(async () => {
  const dbHealth = await db.healthCheck();
  return {
    services: {
      database: dbHealth ? 'healthy' : 'unhealthy',
      websocket: webSocketService ? 'healthy' : 'unhealthy',
      collaboration: collaborationService ? 'healthy' : 'unhealthy'
    }
  };
});

// Setup API documentation endpoints
apiGateway.setupAPIDocumentation();

// Setup backward compatibility
apiGateway.setupBackwardCompatibility();

// Register all routes with the API Gateway with enhanced security
const routeConfigs: RouteConfig[] = [
  {
    path: '/auth',
    router: authRouter,
    version: 'v1',
    requiresAuth: false,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Very restrictive for auth endpoints to prevent brute force
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    }
  },
  {
    path: '/users',
    router: userRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50 // Standard rate limit for user operations
    }
  },
  {
    path: '/assessments',
    router: assessmentRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 30 // Limited for assessment endpoints
    }
  },
  {
    path: '/learning-paths',
    router: learningPathRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 40 // Moderate limit for learning path operations
    }
  },
  {
    path: '/progress',
    router: createProgressRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 60 // Higher limit for frequent progress updates
    }
  },
  {
    path: '/adaptive-difficulty',
    router: createAdaptiveDifficultyRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 40 // Moderate limit for AI-powered features
    }
  },
  {
    path: '/collaboration',
    router: createCollaborationRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50 // Standard limit for collaboration features
    }
  },
  {
    path: '/safety',
    router: createSafetyModerationRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 30 // Limited for safety/moderation endpoints
    }
  },
  {
    path: '/monitoring',
    router: createMonitoringRoutes(),
    version: 'v1',
    requiresAuth: false, // Health checks should be accessible without auth
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100 // Higher limit for monitoring endpoints
    }
  }
];

// Register all routes
apiGateway.registerRoutes(routeConfigs);

// WebSocket status endpoint (special case, not going through gateway)
app.get('/api/v1/collaboration/active-sessions', (req, res) => {
  const activeSessions = webSocketService.getActiveCollaborations();
  res.json({
    success: true,
    data: {
      sessions: activeSessions,
      totalSessions: activeSessions.length,
      totalParticipants: activeSessions.reduce((sum, session) => sum + session.participantCount, 0)
    }
  });
});

// Monitoring endpoints
app.get('/api/metrics', createMetricsEndpoint());
app.get('/api/metrics/detailed', createDetailedMetricsEndpoint());

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server with HTTP and WebSocket support
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} with WebSocket support`);
  logger.info(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

export default app;