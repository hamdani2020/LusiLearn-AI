import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
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
import { errorHandler } from './middleware/error-handler';
import { monitoringMiddleware, securityMonitoringMiddleware, createMetricsEndpoint, createDetailedMetricsEndpoint } from './middleware/monitoring';
import { APIGateway, GatewayConfig, RouteConfig } from './gateway/api-gateway';
import { WebSocketService } from './services/websocket.service';
import { CollaborationService } from './services/collaboration.service';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Monitoring middleware (before rate limiting)
app.use(monitoringMiddleware);
app.use(securityMonitoringMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Initialize services
const collaborationService = new CollaborationService(db.getPool());
const webSocketService = new WebSocketService(httpServer, db.getPool(), collaborationService);

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

// Register all routes with the API Gateway
const routeConfigs: RouteConfig[] = [
  {
    path: '/auth',
    router: authRouter,
    version: 'v1',
    requiresAuth: false,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20 // More restrictive for auth endpoints
    }
  },
  {
    path: '/users',
    router: userRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50
    }
  },
  {
    path: '/assessments',
    router: assessmentRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 30
    }
  },
  {
    path: '/learning-paths',
    router: learningPathRouter,
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 40
    }
  },
  {
    path: '/progress',
    router: createProgressRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 60
    }
  },
  {
    path: '/adaptive-difficulty',
    router: createAdaptiveDifficultyRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 40
    }
  },
  {
    path: '/collaboration',
    router: createCollaborationRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 50
    }
  },
  {
    path: '/safety',
    router: createSafetyModerationRoutes(db.getPool()),
    version: 'v1',
    requiresAuth: true,
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 30
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