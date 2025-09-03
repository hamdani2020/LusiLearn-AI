import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { adaptiveDifficultyRouter } from '../../routes/adaptive-difficulty.routes';
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

describe('Adaptive Difficulty API Integration Tests', () => {
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
    app.use('/api/v1/adaptive-difficulty', adaptiveDifficultyRouter);
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
      await testDb.query('DELETE FROM learning_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%adaptive.test%']);
      await testDb.query('DELETE FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%adaptive.test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%adaptive.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'adaptive.test@example.com',
    password: 'TestPassword123!',
    username: 'adaptivetest',
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

  describe('Difficulty Assessment', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should assess current difficulty level successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/assess/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentLevel');
      expect(response.body.data).toHaveProperty('recommendedLevel');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('reasoning');
    });

    it('should require authentication for difficulty assessment', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/assess/${testLearningPath.id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should handle non-existent learning path', async () => {
      const response = await request(app)
        .get('/api/v1/adaptive-difficulty/assess/non-existent-path')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Learning path not found');
    });
  });

  describe('Difficulty Adjustment', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should adjust difficulty based on performance data', async () => {
      const performanceData = {
        sessionId: 'session-123',
        comprehensionScore: 45, // Low score should decrease difficulty
        timeSpent: 45,
        strugglingConcepts: ['closures', 'async-await'],
        masteredConcepts: ['variables'],
        errorRate: 0.6,
        completionRate: 0.3
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/adjust/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(performanceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('previousLevel');
      expect(response.body.data).toHaveProperty('newLevel');
      expect(response.body.data).toHaveProperty('adjustment');
      expect(response.body.data).toHaveProperty('reasoning');
      
      // Low performance should result in easier content
      expect(response.body.data.adjustment).toBe('decrease');
    });

    it('should increase difficulty for high performance', async () => {
      const performanceData = {
        sessionId: 'session-124',
        comprehensionScore: 95, // High score should increase difficulty
        timeSpent: 20,
        strugglingConcepts: [],
        masteredConcepts: ['variables', 'functions', 'loops'],
        errorRate: 0.05,
        completionRate: 0.95
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/adjust/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(performanceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.adjustment).toBe('increase');
    });

    it('should maintain difficulty for optimal performance', async () => {
      const performanceData = {
        sessionId: 'session-125',
        comprehensionScore: 78, // Optimal score should maintain difficulty
        timeSpent: 35,
        strugglingConcepts: ['closures'],
        masteredConcepts: ['variables', 'functions'],
        errorRate: 0.22,
        completionRate: 0.78
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/adjust/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(performanceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.adjustment).toBe('maintain');
    });

    it('should validate performance data', async () => {
      const invalidData = {
        comprehensionScore: 150, // Invalid score > 100
        timeSpent: -10, // Invalid negative time
        errorRate: 1.5 // Invalid rate > 1
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/adjust/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Content Sequencing', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should get next content based on current difficulty', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/next-content/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('difficulty');
      expect(response.body.data).toHaveProperty('prerequisites');
      expect(response.body.data).toHaveProperty('estimatedDuration');
      expect(Array.isArray(response.body.data.content)).toBe(true);
    });

    it('should respect prerequisite requirements', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/next-content/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ checkPrerequisites: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prerequisites).toBeDefined();
      
      // Should not recommend advanced content without prerequisites
      const advancedContent = response.body.data.content.filter(
        (item: any) => item.difficulty === DifficultyLevel.ADVANCED
      );
      expect(advancedContent.length).toBe(0);
    });

    it('should filter content by learning style', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/next-content/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          learningStyle: 'visual',
          contentTypes: 'video,interactive'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Should prioritize visual content types
      const visualContent = response.body.data.content.filter(
        (item: any) => ['video', 'interactive'].includes(item.type)
      );
      expect(visualContent.length).toBeGreaterThan(0);
    });
  });

  describe('Competency Testing', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should create competency test for advancement', async () => {
      const testRequest = {
        targetLevel: DifficultyLevel.INTERMEDIATE,
        topics: ['variables', 'functions', 'loops'],
        testType: 'advancement'
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/competency-test/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('testId');
      expect(response.body.data).toHaveProperty('questions');
      expect(response.body.data).toHaveProperty('timeLimit');
      expect(response.body.data).toHaveProperty('passingScore');
      expect(Array.isArray(response.body.data.questions)).toBe(true);
    });

    it('should submit competency test results', async () => {
      // First create a test
      const testRequest = {
        targetLevel: DifficultyLevel.INTERMEDIATE,
        topics: ['variables', 'functions'],
        testType: 'advancement'
      };

      const createResponse = await request(app)
        .post(`/api/v1/adaptive-difficulty/competency-test/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testRequest);

      const testId = createResponse.body.data.testId;

      // Submit test results
      const testResults = {
        answers: [
          { questionId: 'q1', answer: 'A', correct: true },
          { questionId: 'q2', answer: 'B', correct: true },
          { questionId: 'q3', answer: 'C', correct: false }
        ],
        timeSpent: 300, // 5 minutes
        completedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/competency-test/${testId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testResults)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('passed');
      expect(response.body.data).toHaveProperty('feedback');
      expect(response.body.data).toHaveProperty('recommendations');
    });

    it('should handle test failure appropriately', async () => {
      // Create and submit a failing test
      const testRequest = {
        targetLevel: DifficultyLevel.ADVANCED,
        topics: ['closures', 'prototypes', 'async-programming'],
        testType: 'advancement'
      };

      const createResponse = await request(app)
        .post(`/api/v1/adaptive-difficulty/competency-test/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testRequest);

      const testId = createResponse.body.data.testId;

      const failingResults = {
        answers: [
          { questionId: 'q1', answer: 'A', correct: false },
          { questionId: 'q2', answer: 'B', correct: false },
          { questionId: 'q3', answer: 'C', correct: true }
        ],
        timeSpent: 600,
        completedAt: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/v1/adaptive-difficulty/competency-test/${testId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(failingResults)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.passed).toBe(false);
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Analytics', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should get difficulty progression analytics', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/analytics/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('progressionHistory');
      expect(response.body.data).toHaveProperty('currentPerformance');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('trends');
    });

    it('should filter analytics by date range', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/analytics/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.progressionHistory).toBeDefined();
    });

    it('should get performance insights', async () => {
      const response = await request(app)
        .get(`/api/v1/adaptive-difficulty/insights/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('strengths');
      expect(response.body.data).toHaveProperty('weaknesses');
      expect(response.body.data).toHaveProperty('learningPatterns');
      expect(response.body.data).toHaveProperty('recommendations');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/adjust/test-path')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle invalid auth tokens', async () => {
      const response = await request(app)
        .get('/api/v1/adaptive-difficulty/assess/test-path')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/adaptive-difficulty/adjust/test-path')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on adaptive difficulty endpoints', async () => {
      const testLearningPath = await createTestLearningPath(testUser.id);
      
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .get(`/api/v1/adaptive-difficulty/assess/${testLearningPath.id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});