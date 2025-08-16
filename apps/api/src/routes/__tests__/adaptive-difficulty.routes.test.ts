import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { DifficultyLevel } from '@lusilearn/shared-types';
import { createAdaptiveDifficultyRoutes } from '../adaptive-difficulty.routes';
import { authMiddleware } from '../../middleware/auth';

// Mock the dependencies
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn()
}));
jest.mock('../../services/learning-path.service');
jest.mock('../../services/adaptive-difficulty.service');
jest.mock('../../utils/logger');

describe('Adaptive Difficulty Routes', () => {
  let app: express.Application;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock auth middleware to add user to request
    (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'user-123' };
      next();
    });

    // Mount the routes
    app.use('/api/v1/adaptive-difficulty', createAdaptiveDifficultyRoutes(mockPool));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/adaptive-difficulty/analyze', () => {
    const mockRequestBody = {
      pathId: 'path-456',
      recentSessions: [
        {
          id: 'session-1',
          userId: 'user-123',
          pathId: 'path-456',
          contentItems: ['content-1'],
          duration: 1800,
          interactions: [],
          assessmentResults: [
            {
              questionId: 'math-1',
              answer: '5',
              isCorrect: true,
              timeSpent: 30,
              attempts: 1
            }
          ],
          comprehensionScore: 95,
          engagementMetrics: {
            attentionScore: 90,
            interactionCount: 15,
            pauseCount: 2,
            replayCount: 1,
            completionRate: 100
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    };

    it('should analyze performance and return difficulty adjustment', async () => {
      // Mock the service to return a difficulty adjustment
      const mockAdjustmentResult = {
        newDifficulty: DifficultyLevel.ADVANCED,
        reason: 'Consistent high performance indicates readiness for increased difficulty',
        confidence: 85,
        recommendedActions: ['Introduce more complex concepts']
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.adaptDifficulty = jest.fn().mockResolvedValue(mockAdjustmentResult);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/analyze')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newDifficulty).toBe(DifficultyLevel.ADVANCED);
      expect(response.body.data.confidence).toBe(85);
      expect(response.body.message).toContain('successfully');
    });

    it('should return null when no adjustment is needed', async () => {
      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.adaptDifficulty = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/analyze')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toContain('No difficulty adjustment needed');
    });

    it('should return 400 for invalid request data', async () => {
      const invalidRequestBody = {
        pathId: 'path-456',
        // Missing recentSessions
      };

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/analyze')
        .send(invalidRequestBody)
        .expect(400);

      expect(response.body.error).toBe('Invalid request data');
      expect(response.body.details).toBeDefined();
    });

    it('should return 401 when user is not authenticated', async () => {
      // Mock auth middleware to not add user
      (authMiddleware as jest.Mock).mockImplementation((req: any, res: any, next: any) => {
        next();
      });

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/analyze')
        .send(mockRequestBody)
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });
  });

  describe('POST /api/v1/adaptive-difficulty/next-content', () => {
    const mockRequestBody = {
      pathId: 'path-456'
    };

    it('should return content sequence based on prerequisites', async () => {
      const mockContentSequence = {
        nextObjectives: [
          {
            id: 'obj-1',
            title: 'Basic Addition',
            description: 'Learn basic addition',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['addition']
          }
        ],
        prerequisitesMet: true,
        blockedObjectives: [],
        recommendedReview: []
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.getNextContent = jest.fn().mockResolvedValue(mockContentSequence);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/next-content')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nextObjectives).toHaveLength(1);
      expect(response.body.data.prerequisitesMet).toBe(true);
      expect(response.body.message).toContain('successfully');
    });

    it('should return blocked objectives when prerequisites are not met', async () => {
      const mockContentSequence = {
        nextObjectives: [],
        prerequisitesMet: false,
        blockedObjectives: ['obj-2', 'obj-3'],
        recommendedReview: ['obj-1']
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.getNextContent = jest.fn().mockResolvedValue(mockContentSequence);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/next-content')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prerequisitesMet).toBe(false);
      expect(response.body.data.blockedObjectives).toHaveLength(2);
      expect(response.body.data.recommendedReview).toContain('obj-1');
    });
  });

  describe('POST /api/v1/adaptive-difficulty/request-advancement', () => {
    const mockRequestBody = {
      pathId: 'path-456',
      requestedLevel: DifficultyLevel.ADVANCED
    };

    it('should approve advancement when competency test passes', async () => {
      const mockTestResult = {
        passed: true,
        score: 85,
        skillsAssessed: ['algebra', 'geometry'],
        weakAreas: [],
        readyForAdvancement: true
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.requestAdvancement = jest.fn().mockResolvedValue(mockTestResult);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/request-advancement')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.passed).toBe(true);
      expect(response.body.data.score).toBe(85);
      expect(response.body.message).toContain('passed');
    });

    it('should deny advancement when competency test fails', async () => {
      const mockTestResult = {
        passed: false,
        score: 65,
        skillsAssessed: ['algebra', 'geometry'],
        weakAreas: ['geometry'],
        readyForAdvancement: false
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.requestAdvancement = jest.fn().mockResolvedValue(mockTestResult);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/request-advancement')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.passed).toBe(false);
      expect(response.body.data.weakAreas).toContain('geometry');
      expect(response.body.message).toContain('not passed');
    });
  });

  describe('POST /api/v1/adaptive-difficulty/optimal-challenge', () => {
    const mockRequestBody = {
      pathId: 'path-456'
    };

    it('should return optimal challenge analysis', async () => {
      const mockAnalysis = {
        currentChallengeLevel: 78,
        isOptimal: true,
        adjustment: 'maintain' as const,
        targetComprehension: 78
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.maintainOptimalChallenge = jest.fn().mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/optimal-challenge')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isOptimal).toBe(true);
      expect(response.body.data.adjustment).toBe('maintain');
      expect(response.body.message).toContain('optimal');
    });

    it('should recommend adjustment when challenge level is not optimal', async () => {
      const mockAnalysis = {
        currentChallengeLevel: 92,
        isOptimal: false,
        adjustment: 'increase' as const,
        targetComprehension: 85
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.maintainOptimalChallenge = jest.fn().mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/optimal-challenge')
        .send(mockRequestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isOptimal).toBe(false);
      expect(response.body.data.adjustment).toBe('increase');
      expect(response.body.message).toContain('increase');
    });
  });

  describe('GET /api/v1/adaptive-difficulty/path/:pathId/analysis', () => {
    it('should return comprehensive adaptive difficulty analysis', async () => {
      const mockContentSequence = {
        nextObjectives: [
          {
            id: 'obj-1',
            title: 'Basic Addition',
            description: 'Learn basic addition',
            estimatedDuration: 60,
            prerequisites: [],
            skills: ['addition']
          }
        ],
        prerequisitesMet: true,
        blockedObjectives: [],
        recommendedReview: []
      };

      const mockOptimalChallenge = {
        currentChallengeLevel: 78,
        isOptimal: true,
        adjustment: 'maintain' as const,
        targetComprehension: 78
      };

      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.getNextContent = jest.fn().mockResolvedValue(mockContentSequence);
      LearningPathService.prototype.maintainOptimalChallenge = jest.fn().mockResolvedValue(mockOptimalChallenge);

      const response = await request(app)
        .get('/api/v1/adaptive-difficulty/path/path-456/analysis')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentSequence).toBeDefined();
      expect(response.body.data.optimalChallenge).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.recommendations.nextActions).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      const LearningPathService = require('../../services/learning-path.service').LearningPathService;
      LearningPathService.prototype.adaptDifficulty = jest.fn().mockRejectedValue(new Error('Service error'));

      const mockRequestBody = {
        pathId: 'path-456',
        recentSessions: []
      };

      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/analyze')
        .send(mockRequestBody)
        .expect(500);

      expect(response.body.error).toBe('Failed to analyze difficulty adjustment');
      expect(response.body.message).toBe('Service error');
    });
  });
});