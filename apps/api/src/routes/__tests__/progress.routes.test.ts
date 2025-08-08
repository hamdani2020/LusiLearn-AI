import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createProgressRoutes } from '../progress.routes';
import { 
  LearningSession, 
  ProgressUpdate, 
  LearningAnalytics,
  Achievement,
  DifficultyLevel
} from '@lusilearn/shared-types';

// Mock the logger first
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the progress tracking service
const mockProgressService = {
  updateProgress: jest.fn(),
  calculateAnalytics: jest.fn(),
  trackMilestone: jest.fn(),
  getUserAchievements: jest.fn(),
  getProgressVisualizationData: jest.fn()
};

jest.mock('../../services/progress-tracking.service', () => ({
  ProgressTrackingService: jest.fn().mockImplementation(() => mockProgressService)
}));

// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'test@example.com',
      role: 'user'
    };
    next();
  }
}));

describe('Progress Routes', () => {
  let app: express.Application;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
    } as any;

    // Replace the service instance in the routes
    const progressRoutes = createProgressRoutes(mockPool);
    app.use('/api/v1/progress', progressRoutes);

    // Add error handler for testing
    app.use((error: any, req: any, res: any, next: any) => {
      console.log('Test error handler:', error.message);
      res.status(500).json({ error: error.message, stack: error.stack });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/progress/update', () => {
    it('should update progress successfully', async () => {
      // Arrange
      const mockSessionData: LearningSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001', // Match the auth middleware user ID
        pathId: '550e8400-e29b-41d4-a716-446655440002',
        contentItems: ['content-1'],
        duration: 1800,
        interactions: [],
        assessmentResults: [],
        comprehensionScore: 85,
        engagementMetrics: {
          attentionScore: 90,
          interactionCount: 15,
          pauseCount: 2,
          replayCount: 1,
          completionRate: 100
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const mockProgressUpdate: ProgressUpdate = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001', // Match the auth middleware user ID
        pathId: '550e8400-e29b-41d4-a716-446655440002',
        timestamp: new Date(),
        progressData: {
          objectivesCompleted: [],
          milestonesReached: [],
          skillsImproved: [],
          timeSpent: 1800,
          comprehensionScore: 85,
          engagementLevel: 90
        }
      };

      mockProgressService.updateProgress.mockResolvedValue(mockProgressUpdate);

      // Act
      const response = await request(app)
        .post('/api/v1/progress/update')
        .send(mockSessionData);

      // Assert
      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.objectContaining({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        pathId: '550e8400-e29b-41d4-a716-446655440002'
      }));
      expect(mockProgressService.updateProgress).toHaveBeenCalledWith(expect.objectContaining({
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        pathId: '550e8400-e29b-41d4-a716-446655440002',
        duration: 1800,
        comprehensionScore: 85,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));
    });

    it('should return 403 when user tries to update progress for another user', async () => {
      // Arrange
      const mockSessionData: LearningSession = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        userId: '550e8400-e29b-41d4-a716-446655440004', // Different user ID
        pathId: '550e8400-e29b-41d4-a716-446655440005',
        contentItems: [],
        duration: 0,
        interactions: [],
        assessmentResults: [],
        comprehensionScore: 0,
        engagementMetrics: {
          attentionScore: 0,
          interactionCount: 0,
          pauseCount: 0,
          replayCount: 0,
          completionRate: 0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Act
      const response = await request(app)
        .post('/api/v1/progress/update')
        .send(mockSessionData);

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
      expect(mockProgressService.updateProgress).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/progress/analytics/:timeframe', () => {
    it('should return analytics for valid timeframe', async () => {
      // Arrange
      const mockAnalytics: LearningAnalytics = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        timeframe: 'weekly',
        metrics: {
          totalTimeSpent: 300,
          sessionsCompleted: 10,
          averageSessionDuration: 30,
          comprehensionTrend: [80, 85, 90],
          engagementTrend: [75, 80, 85],
          objectivesCompleted: 5,
          milestonesReached: 2,
          skillsImproved: 3,
          achievementsEarned: 4,
          collaborationHours: 0,
          consistencyScore: 85
        },
        insights: {
          strongestSubjects: ['Mathematics'],
          improvementAreas: ['Science'],
          optimalLearningTimes: ['morning'],
          recommendedSessionDuration: 30,
          learningVelocity: 2.5,
          retentionRate: 85
        },
        predictions: {
          nextMilestoneETA: new Date(),
          goalCompletionProbability: 85,
          suggestedFocusAreas: ['algebra'],
          riskFactors: []
        }
      };

      mockProgressService.calculateAnalytics.mockResolvedValue(mockAnalytics);

      // Act
      const response = await request(app)
        .get('/api/v1/progress/analytics/weekly');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.objectContaining({
        userId: '550e8400-e29b-41d4-a716-446655440001',
        timeframe: 'weekly',
        metrics: expect.any(Object),
        insights: expect.any(Object),
        predictions: expect.any(Object)
      }));
      expect(mockProgressService.calculateAnalytics).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', 'weekly');
    });

    it('should return 400 for invalid timeframe', async () => {
      // Act
      const response = await request(app)
        .get('/api/v1/progress/analytics/invalid');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid timeframe');
      expect(mockProgressService.calculateAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/progress/achievements', () => {
    it('should return user achievements', async () => {
      // Arrange
      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        }
      ];

      mockProgressService.getUserAchievements.mockResolvedValue(mockAchievements);

      // Act
      const response = await request(app)
        .get('/api/v1/progress/achievements');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          points: 100
        })
      ]));
      expect(mockProgressService.getUserAchievements).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', undefined);
    });

    it('should filter achievements by type when type query parameter is provided', async () => {
      // Arrange
      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        }
      ];

      mockProgressService.getUserAchievements.mockResolvedValue(mockAchievements);

      // Act
      const response = await request(app)
        .get('/api/v1/progress/achievements?type=milestone');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          points: 100
        })
      ]));
      expect(mockProgressService.getUserAchievements).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', 'milestone');
    });
  });

  describe('POST /api/v1/progress/milestone/:pathId/:milestoneId', () => {
    it('should track milestone completion and return achievement', async () => {
      // Arrange
      const pathId = 'path-123';
      const milestoneId = 'milestone-1';
      const mockAchievement: Achievement = {
        id: 'achievement-1',
        type: 'milestone',
        title: 'Milestone Completed',
        description: 'Successfully completed milestone',
        criteria: { milestoneId, pathId },
        earnedAt: new Date(),
        points: 125
      };

      mockProgressService.trackMilestone.mockResolvedValue(mockAchievement);

      // Act
      const response = await request(app)
        .post(`/api/v1/progress/milestone/${pathId}/${milestoneId}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.objectContaining({
        id: 'achievement-1',
        type: 'milestone',
        points: 125
      }));
      expect(response.body.message).toBe('Milestone completed and achievement awarded!');
      expect(mockProgressService.trackMilestone).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', pathId, milestoneId);
    });

    it('should return null when milestone is not yet completed', async () => {
      // Arrange
      const pathId = 'path-123';
      const milestoneId = 'milestone-1';

      mockProgressService.trackMilestone.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/v1/progress/milestone/${pathId}/${milestoneId}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('Milestone not yet completed');
    });
  });

  describe('GET /api/v1/progress/dashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      // Arrange
      const mockWeeklyAnalytics: LearningAnalytics = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        timeframe: 'weekly',
        metrics: {
          totalTimeSpent: 300,
          sessionsCompleted: 10,
          averageSessionDuration: 30,
          comprehensionTrend: [80, 85, 90],
          engagementTrend: [75, 80, 85],
          objectivesCompleted: 5,
          milestonesReached: 2,
          skillsImproved: 3,
          achievementsEarned: 4,
          collaborationHours: 0,
          consistencyScore: 85
        },
        insights: {
          strongestSubjects: ['Mathematics'],
          improvementAreas: ['Science'],
          optimalLearningTimes: ['morning'],
          recommendedSessionDuration: 30,
          learningVelocity: 2.5,
          retentionRate: 85
        },
        predictions: {
          nextMilestoneETA: new Date(),
          goalCompletionProbability: 85,
          suggestedFocusAreas: ['algebra'],
          riskFactors: []
        }
      };

      const mockMonthlyAnalytics: LearningAnalytics = {
        ...mockWeeklyAnalytics,
        timeframe: 'monthly'
      };

      const mockAchievements: Achievement[] = [
        {
          id: 'achievement-1',
          type: 'milestone',
          title: 'First Milestone',
          description: 'Completed first milestone',
          criteria: {},
          earnedAt: new Date(),
          points: 100
        }
      ];

      mockProgressService.calculateAnalytics
        .mockResolvedValueOnce(mockWeeklyAnalytics)
        .mockResolvedValueOnce(mockMonthlyAnalytics);
      mockProgressService.getUserAchievements.mockResolvedValue(mockAchievements);

      // Act
      const response = await request(app)
        .get('/api/v1/progress/dashboard');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(expect.objectContaining({
        weeklyAnalytics: expect.objectContaining({ timeframe: 'weekly' }),
        monthlyAnalytics: expect.objectContaining({ timeframe: 'monthly' }),
        recentAchievements: expect.any(Array),
        totalPoints: 100,
        totalAchievements: 1
      }));
    });
  });
});