import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { learningPathRouter, initializeLearningPathRoutes } from '../../routes/learning-path';
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

describe('Learning Path API Integration Tests', () => {
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

    // Get database connection
    testDb = db.getPool();
    
    // Initialize learning path routes with database
    initializeLearningPathRoutes(testDb);
    
    // Setup routes
    app.use('/api/v1/learning-paths', learningPathRouter);
    app.use(errorHandler);

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
      await testDb.query('DELETE FROM learning_path_shares WHERE learning_path_id IN (SELECT id FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await testDb.query('DELETE FROM learning_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await testDb.query('DELETE FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'learningpath.test@example.com',
    password: 'TestPassword123!',
    username: 'learningpathtest',
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
      estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
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

  describe('Learning Path Creation', () => {
    it('should create a new learning path successfully', async () => {
      const pathData = {
        subject: 'javascript',
        goals: [
          {
            objective: 'Learn JavaScript fundamentals',
            timeline: '2-months',
            priority: 'high'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/learning-paths')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pathData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Learning path created successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.subject).toBe(pathData.subject);
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.objectives).toBeDefined();
      expect(Array.isArray(response.body.data.objectives)).toBe(true);
    });

    it('should reject learning path creation without authentication', async () => {
      const pathData = {
        subject: 'javascript',
        goals: [{ objective: 'Learn JavaScript', timeline: '2-months', priority: 'high' }]
      };

      const response = await request(app)
        .post('/api/v1/learning-paths')
        .send(pathData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should reject learning path creation with invalid data', async () => {
      const pathData = {
        subject: '', // Invalid empty subject
        goals: []    // Invalid empty goals
      };

      const response = await request(app)
        .post('/api/v1/learning-paths')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pathData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Learning Path Retrieval', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should get all user learning paths', async () => {
      const response = await request(app)
        .get('/api/v1/learning-paths')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].id).toBe(testLearningPath.id);
      expect(response.body.data[0].userId).toBe(testUser.id);
    });

    it('should get specific learning path by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/learning-paths/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testLearningPath.id);
      expect(response.body.data.subject).toBe(testLearningPath.subject);
      expect(response.body.data.objectives).toBeDefined();
    });

    it('should return 404 for non-existent learning path', async () => {
      const response = await request(app)
        .get('/api/v1/learning-paths/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Learning path not found');
    });

    it('should deny access to other users learning paths', async () => {
      // Create another user
      const otherUserData = {
        ...createTestUserData(),
        email: 'other.learningpath.test@example.com',
        username: 'otherlearningpathtest'
      };
      const otherUser = await createTestUser(otherUserData);
      const otherUserPath = await createTestLearningPath(otherUser.id);

      const response = await request(app)
        .get(`/api/v1/learning-paths/${otherUserPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied to this learning path');
    });
  });

  describe('Learning Path Updates', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should update learning path successfully', async () => {
      const updateData = {
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'obj-1',
            title: 'Advanced JavaScript Variables',
            description: 'Learn about advanced variable concepts',
            completed: false,
            estimatedDuration: 45
          }
        ]
      };

      const response = await request(app)
        .put(`/api/v1/learning-paths/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Learning path updated successfully');
      expect(response.body.data.currentLevel).toBe(DifficultyLevel.INTERMEDIATE);
    });

    it('should deny update access to other users learning paths', async () => {
      // Create another user
      const otherUserData = {
        ...createTestUserData(),
        email: 'other.update.test@example.com',
        username: 'otherupdatetest'
      };
      const otherUser = await createTestUser(otherUserData);
      const otherUserPath = await createTestLearningPath(otherUser.id);

      const updateData = {
        currentLevel: DifficultyLevel.INTERMEDIATE
      };

      const response = await request(app)
        .put(`/api/v1/learning-paths/${otherUserPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied - you can only modify your own learning paths');
    });
  });

  describe('Progress Tracking', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should update learning progress successfully', async () => {
      const progressData = {
        sessionId: 'session-123',
        comprehensionScore: 85,
        timeSpent: 30,
        strugglingConcepts: ['closures'],
        masteredConcepts: ['variables', 'functions']
      };

      const response = await request(app)
        .post(`/api/v1/learning-paths/${testLearningPath.id}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(progressData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Progress updated successfully');
      expect(response.body.data).toBeDefined();
    });

    it('should complete objective successfully', async () => {
      const objectiveId = 'obj-1';
      const completionData = {
        sessionDuration: 25,
        comprehensionScore: 90
      };

      const response = await request(app)
        .post(`/api/v1/learning-paths/${testLearningPath.id}/objectives/${objectiveId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(completionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Objective completed successfully');
      expect(response.body.data.completedObjective).toBeDefined();
      expect(response.body.data.completedObjective.id).toBe(objectiveId);
    });

    it('should return 404 for non-existent objective', async () => {
      const objectiveId = 'non-existent-obj';
      const completionData = {
        sessionDuration: 25,
        comprehensionScore: 90
      };

      const response = await request(app)
        .post(`/api/v1/learning-paths/${testLearningPath.id}/objectives/${objectiveId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(completionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Objective not found');
    });
  });

  describe('Learning Path Sharing', () => {
    let testLearningPath: any;
    let otherUser: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
      
      // Create another user to share with
      const otherUserData = {
        ...createTestUserData(),
        email: 'share.target.test@example.com',
        username: 'sharetargettest'
      };
      otherUser = await createTestUser(otherUserData);
    });

    it('should share learning path successfully', async () => {
      const shareData = {
        sharedWithUserId: otherUser.id,
        permissions: 'view' as const,
        message: 'Check out my JavaScript learning path!'
      };

      const response = await request(app)
        .post(`/api/v1/learning-paths/${testLearningPath.id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Learning path shared successfully');
    });

    it('should deny sharing other users learning paths', async () => {
      // Create another user and their path
      const thirdUserData = {
        ...createTestUserData(),
        email: 'third.user.test@example.com',
        username: 'thirdusertest'
      };
      const thirdUser = await createTestUser(thirdUserData);
      const thirdUserPath = await createTestLearningPath(thirdUser.id);

      const shareData = {
        sharedWithUserId: otherUser.id,
        permissions: 'view' as const
      };

      const response = await request(app)
        .post(`/api/v1/learning-paths/${thirdUserPath.id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied - you can only share your own learning paths');
    });
  });

  describe('Learning Path Deletion', () => {
    let testLearningPath: any;

    beforeEach(async () => {
      testLearningPath = await createTestLearningPath(testUser.id);
    });

    it('should delete learning path successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/learning-paths/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Learning path deleted successfully');

      // Verify path is deleted
      const getResponse = await request(app)
        .get(`/api/v1/learning-paths/${testLearningPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(getResponse.body.success).toBe(false);
    });

    it('should deny deletion of other users learning paths', async () => {
      // Create another user and their path
      const otherUserData = {
        ...createTestUserData(),
        email: 'delete.other.test@example.com',
        username: 'deleteothertest'
      };
      const otherUser = await createTestUser(otherUserData);
      const otherUserPath = await createTestLearningPath(otherUser.id);

      const response = await request(app)
        .delete(`/api/v1/learning-paths/${otherUserPath.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied - you can only delete your own learning paths');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/learning-paths')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle invalid auth tokens', async () => {
      const pathData = {
        subject: 'javascript',
        goals: [{ objective: 'Learn JavaScript', timeline: '2-months', priority: 'high' }]
      };

      const response = await request(app)
        .post('/api/v1/learning-paths')
        .set('Authorization', 'Bearer invalid-token')
        .send(pathData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });
});