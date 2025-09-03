import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { progressRouter } from '../../routes/progress.routes';
import { authRouter } from '../../routes/auth';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { AgeRange, EducationLevel, LearningStyle, ContentType, DifficultyLevel } from '@lusilearn/shared-types';
import { AuthService } from '../../services/auth.service';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Progress Tracking API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;
  let authService: AuthService;

  beforeAll(async () => {
    // Setup test app
    app = express();
    
    // Setup middleware
    setupSecurityMiddleware(app, {
      cors: {
        origin: 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 1000, // Higher limit for tests
      },
      https: {
        enforceHttps: false,
        trustProxy: true,
      },
    });

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(monitoringMiddleware);

    // Setup routes
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/progress', progressRouter);
    app.use(errorHandler);

    // Get database connection
    testDb = db.getPool();

    // Initialize auth service
    authService = new AuthService(testDb);

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
    
    // Create test user and get auth token
    const userData = createTestUserData();
    testUser = await createTestUser(userData);
    authToken = await generateAuthToken(testUser.id);
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM learning_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%progress.test%']);
      await testDb.query('DELETE FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%progress.test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%progress.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'progress.test@example.com',
    password: 'TestPassword123!',
    username: 'progresstest',
    demographics: {
      ageRange: AgeRange.YOUNG_ADULT,
      educationLevel: EducationLevel.COLLEGE,
      timezone: 'America/New_York',
      preferredLanguage: 'en'
    },
    learningPreferences: {
      learningStyle: [LearningStyle.VISUAL, LearningStyle.HANDS_ON],
      preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
      sessionDuration: 60,
      difficultyPreference: 'moderate' as const
    }
  });

  const createTestUser = async (userData: any) => {
    const hashedPassword = await authService.hashPassword(userData.password);
    
    const query = `
      INSERT INTO users (email, password_hash, username, demographics, learning_preferences, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, email, username, demographics, learning_preferences, created_at, updated_at
    `;

    const result = await testDb.query(query, [
      userData.email,
      hashedPassword,
      userData.username,
      JSON.stringify(userData.demographics),
      JSON.stringify(userData.learningPreferences)
    ]);

    return result.rows[0];
  };

  const generateAuthToken = async (userId: string): Promise<string> => {
    return authService.generateAccessToken(userId);
  };

  const createTestLearningPath = async (userId: string, subject: string = 'javascript') => {
    const query = `
      INSERT INTO learning_paths (
        id, user_id, subject, current_level, objectives, progress, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const pathId = `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const objectives = [
      {
        id: 'obj-1',
        title: 'JavaScript Variables',
        description: 'Learn about variables and data types',
        completed: false,
        estimatedDuration: 30
      },
      {
        id: 'obj-2',
        title: 'JavaScript Functions',
        description: 'Master function declarations and expressions',
        completed: false,
        estimatedDuration: 45
      }
    ];

    const progress = {
      completedObjectives: [],
      currentMilestone: 'obj-1',
      overallProgress: 0,
      estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    const result = await testDb.query(query, [
      pathId,
      userId,
      subject,
      DifficultyLevel.BEGINNER,
      JSON.stringify(objectives),
      JSON.stringify(progress)
    ]);

    return result.rows[0];
  };

  const createTestLearningSession = async (userId: string, pathId: string) => {
    const query = `
      INSERT INTO learning_sessions (
        id, user_id, learning_path_id, content_items, duration, interactions, 
        assessment_results, comprehension_score, engagement_metrics, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const contentItems = ['content-1', 'content-2'];
    const interactions = [
      { type: 'click', timestamp: new Date(), element: 'video-play' },
      { type: 'scroll', timestamp: new Date(), position: 50 }
    ];
    const assessmentResults = [
      { questionId: 'q1', answer: 'A', correct: true, timeSpent: 30 }
    ];
    const engagementMetrics = {
      timeOnContent: 1800,
      interactionCount: 15,
      pauseCount: 3,
      replayCount: 1
    };

    const result = await testDb.query(query, [
      sessionId,
      userId,
      pathId,
      JSON.stringify(contentItems),
      1800, // 30 minutes
      JSON.stringify(interactions),
      JSON.stringify(assessmentResults),
      85, // comprehension score
      JSON.stringify(engagementMetrics)
    ]);

    return result.rows[0];
  };

  describe('Learning Session Tracking', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should start a new learning session', async () => {
      const sessionData = {
        learningPathId: testLearningPath.id,
        contentId: 'content-1',
        sessionType: 'study',
        plannedDuration: 60
      };

      const response = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('startTime');
      expect(response.body.data.learningPathId).toBe(testLearningPath.id);
      expect(response.body.data.status).toBe('active');
    });

    it('should update session progress in real-time', async () => {
      // Start a session first
      const sessionData = {
        learningPathId: testLearningPath.id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      const startResponse = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      const sessionId = startResponse.body.data.sessionId;

      // Update progress
      const progressUpdate = {
        contentProgress: 75,
        timeSpent: 25,
        interactions: [
          { type: 'video-play', timestamp: new Date().toISOString() },
          { type: 'quiz-answer', data: { questionId: 'q1', answer: 'A' } }
        ],
        comprehensionIndicators: {
          questionsCorrect: 3,
          questionsTotal: 4,
          conceptsUnderstood: ['variables', 'data-types']
        }
      };

      const response = await request(app)
        .put(`/api/v1/progress/sessions/${sessionId}/update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(progressUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentProgress).toBe(75);
      expect(response.body.data.timeSpent).toBe(25);
      expect(response.body.data.comprehensionScore).toBeGreaterThan(0);
    });

    it('should end a learning session with summary', async () => {
      // Start and update a session
      const sessionData = {
        learningPathId: testLearningPath.id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      const startResponse = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      const sessionId = startResponse.body.data.sessionId;

      // End the session
      const endData = {
        completionStatus: 'completed',
        finalComprehensionScore: 88,
        strugglingConcepts: ['closures'],
        masteredConcepts: ['variables', 'functions'],
        userFeedback: {
          difficulty: 'appropriate',
          engagement: 'high',
          comments: 'Great content!'
        }
      };

      const response = await request(app)
        .post(`/api/v1/progress/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionSummary');
      expect(response.body.data).toHaveProperty('progressUpdate');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data.sessionSummary.status).toBe('completed');
    });

    it('should handle session interruption gracefully', async () => {
      const sessionData = {
        learningPathId: testLearningPath.id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      const startResponse = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      const sessionId = startResponse.body.data.sessionId;

      // Simulate interruption
      const interruptData = {
        reason: 'user_closed_app',
        lastActivity: new Date().toISOString(),
        partialProgress: 45
      };

      const response = await request(app)
        .post(`/api/v1/progress/sessions/${sessionId}/interrupt`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(interruptData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('interrupted');
      expect(response.body.data.canResume).toBe(true);
    });
  });

  describe('Progress Analytics', () => {
    let testLearningPath: any;
    let testSession: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
      testSession = await createTestLearningSession(testUser.id, testLearningPath.id);
    });

    it('should get comprehensive progress overview', async () => {
      const response = await request(app)
        .get('/api/v1/progress/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalLearningTime');
      expect(response.body.data).toHaveProperty('completedObjectives');
      expect(response.body.data).toHaveProperty('currentStreak');
      expect(response.body.data).toHaveProperty('weeklyProgress');
      expect(response.body.data).toHaveProperty('skillProgress');
      expect(response.body.data).toHaveProperty('achievements');
    });

    it('should get detailed learning path progress', async () => {
      const response = await request(app)
        .get(`/api/v1/progress/learning-paths/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pathId');
      expect(response.body.data).toHaveProperty('overallProgress');
      expect(response.body.data).toHaveProperty('objectiveProgress');
      expect(response.body.data).toHaveProperty('timeSpent');
      expect(response.body.data).toHaveProperty('comprehensionTrend');
      expect(response.body.data).toHaveProperty('milestones');
    });

    it('should get session history with filtering', async () => {
      const response = await request(app)
        .get('/api/v1/progress/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 10,
          offset: 0,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });

    it('should get performance analytics by subject', async () => {
      const response = await request(app)
        .get('/api/v1/progress/analytics/by-subject')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ subject: 'javascript' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('subject');
      expect(response.body.data).toHaveProperty('totalTime');
      expect(response.body.data).toHaveProperty('averageComprehension');
      expect(response.body.data).toHaveProperty('progressTrend');
      expect(response.body.data).toHaveProperty('strengths');
      expect(response.body.data).toHaveProperty('weaknesses');
    });

    it('should get learning velocity metrics', async () => {
      const response = await request(app)
        .get('/api/v1/progress/velocity')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageSessionDuration');
      expect(response.body.data).toHaveProperty('objectivesPerWeek');
      expect(response.body.data).toHaveProperty('comprehensionRate');
      expect(response.body.data).toHaveProperty('consistencyScore');
      expect(response.body.data).toHaveProperty('projectedCompletion');
    });
  });

  describe('Milestone and Achievement Tracking', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should track milestone completion', async () => {
      const milestoneData = {
        milestoneId: 'milestone-1',
        objectiveId: 'obj-1',
        completionData: {
          timeSpent: 45,
          comprehensionScore: 92,
          assessmentResults: [
            { questionId: 'q1', correct: true },
            { questionId: 'q2', correct: true }
          ]
        }
      };

      const response = await request(app)
        .post(`/api/v1/progress/learning-paths/${testLearningPath.id}/milestones/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(milestoneData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('milestone');
      expect(response.body.data).toHaveProperty('achievements');
      expect(response.body.data).toHaveProperty('nextMilestone');
      expect(response.body.data.milestone.completed).toBe(true);
    });

    it('should get user achievements', async () => {
      const response = await request(app)
        .get('/api/v1/progress/achievements')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('achievements');
      expect(response.body.data).toHaveProperty('badges');
      expect(response.body.data).toHaveProperty('streaks');
      expect(response.body.data).toHaveProperty('totalPoints');
      expect(Array.isArray(response.body.data.achievements)).toBe(true);
    });

    it('should track learning streaks', async () => {
      const response = await request(app)
        .get('/api/v1/progress/streaks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentStreak');
      expect(response.body.data).toHaveProperty('longestStreak');
      expect(response.body.data).toHaveProperty('streakHistory');
      expect(response.body.data).toHaveProperty('streakGoals');
    });
  });

  describe('Goal Setting and Tracking', () => {
    it('should set learning goals', async () => {
      const goalData = {
        type: 'completion',
        target: 'Complete JavaScript Fundamentals',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        metrics: {
          objectivesToComplete: 10,
          minimumComprehension: 80,
          timeCommitment: 300 // 5 hours per week
        }
      };

      const response = await request(app)
        .post('/api/v1/progress/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('goalId');
      expect(response.body.data).toHaveProperty('target');
      expect(response.body.data).toHaveProperty('deadline');
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data.status).toBe('active');
    });

    it('should get goal progress', async () => {
      // First set a goal
      const goalData = {
        type: 'time',
        target: 'Study 10 hours this month',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metrics: { targetHours: 10 }
      };

      const goalResponse = await request(app)
        .post('/api/v1/progress/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData);

      const goalId = goalResponse.body.data.goalId;

      // Get goal progress
      const response = await request(app)
        .get(`/api/v1/progress/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('goalId');
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('remainingTime');
      expect(response.body.data).toHaveProperty('onTrack');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    it('should update goal progress automatically', async () => {
      const goalData = {
        type: 'streak',
        target: 'Maintain 7-day learning streak',
        metrics: { targetDays: 7 }
      };

      const goalResponse = await request(app)
        .post('/api/v1/progress/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(goalData);

      const goalId = goalResponse.body.data.goalId;

      // Simulate learning activity that should update goal progress
      const sessionData = {
        learningPathId: (await createTestLearningPath(testUser.id)).id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      // Check if goal progress was updated
      const response = await request(app)
        .get(`/api/v1/progress/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.progress).toBeGreaterThan(0);
    });
  });

  describe('Progress Visualization Data', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
      await createTestLearningSession(testUser.id, testLearningPath.id);
    });

    it('should get data for progress charts', async () => {
      const response = await request(app)
        .get('/api/v1/progress/charts/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeSeriesData');
      expect(response.body.data).toHaveProperty('subjectBreakdown');
      expect(response.body.data).toHaveProperty('comprehensionTrend');
      expect(response.body.data).toHaveProperty('activityHeatmap');
    });

    it('should get skill progression visualization data', async () => {
      const response = await request(app)
        .get('/api/v1/progress/charts/skills')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('skillLevels');
      expect(response.body.data).toHaveProperty('progressionPaths');
      expect(response.body.data).toHaveProperty('competencyMap');
      expect(Array.isArray(response.body.data.skillLevels)).toBe(true);
    });

    it('should get learning pattern analysis', async () => {
      const response = await request(app)
        .get('/api/v1/progress/analysis/patterns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('optimalLearningTimes');
      expect(response.body.data).toHaveProperty('sessionLengthPreference');
      expect(response.body.data).toHaveProperty('contentTypeEffectiveness');
      expect(response.body.data).toHaveProperty('difficultyProgression');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid session IDs', async () => {
      const response = await request(app)
        .put('/api/v1/progress/sessions/invalid-session-id/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contentProgress: 50 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Session not found');
    });

    it('should handle concurrent session updates', async () => {
      const sessionData = {
        learningPathId: (await createTestLearningPath(testUser.id)).id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      const startResponse = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      const sessionId = startResponse.body.data.sessionId;

      // Make concurrent updates
      const update1 = { contentProgress: 50, timeSpent: 25 };
      const update2 = { contentProgress: 60, timeSpent: 30 };

      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/v1/progress/sessions/${sessionId}/update`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(update1),
        request(app)
          .put(`/api/v1/progress/sessions/${sessionId}/update`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(update2)
      ]);

      // At least one should succeed
      expect([response1.status, response2.status]).toContain(200);
    });

    it('should validate progress data ranges', async () => {
      const sessionData = {
        learningPathId: (await createTestLearningPath(testUser.id)).id,
        contentId: 'content-1',
        sessionType: 'study'
      };

      const startResponse = await request(app)
        .post('/api/v1/progress/sessions/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      const sessionId = startResponse.body.data.sessionId;

      const invalidUpdate = {
        contentProgress: 150, // Invalid > 100
        timeSpent: -10, // Invalid negative
        comprehensionIndicators: {
          questionsCorrect: 5,
          questionsTotal: 3 // Invalid: correct > total
        }
      };

      const response = await request(app)
        .put(`/api/v1/progress/sessions/${sessionId}/update`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all progress endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/progress/overview' },
        { method: 'post', path: '/api/v1/progress/sessions/start' },
        { method: 'get', path: '/api/v1/progress/achievements' },
        { method: 'post', path: '/api/v1/progress/goals' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    it('should deny access to other users progress data', async () => {
      // Create another user
      const otherUserData = {
        ...createTestUserData(),
        email: 'other.progress.test@example.com',
        username: 'otherprogresstest'
      };
      const otherUser = await createTestUser(otherUserData);
      const otherUserPath = await createTestLearningPath(otherUser.id);

      const response = await request(app)
        .get(`/api/v1/progress/learning-paths/${otherUserPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied to this learning path');
    });
  });
});