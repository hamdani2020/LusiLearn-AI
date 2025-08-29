import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { userRouter } from '../../routes/user';
import { authRouter } from '../../routes/auth';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { AgeRange, EducationLevel, LearningStyle, ContentType } from '@lusilearn/shared-types';
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

describe('User Management API Integration Tests', () => {
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
    app.use('/api/v1/users', userRouter);
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
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%usermgmt.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'usermgmt.test@example.com',
    password: 'TestPassword123!',
    username: 'usermgmttest',
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
  descr
ibe('User Profile Management', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.username).toBe(testUser.username);
      expect(response.body.data.demographics).toBeDefined();
      expect(response.body.data.learningPreferences).toBeDefined();
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        username: 'updatedusername',
        demographics: {
          ageRange: AgeRange.ADULT,
          educationLevel: EducationLevel.PROFESSIONAL,
          timezone: 'America/Los_Angeles',
          preferredLanguage: 'es'
        }
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(response.body.data.username).toBe(updateData.username);
      expect(response.body.data.demographics.ageRange).toBe(updateData.demographics.ageRange);
    });

    it('should reject profile update with invalid data', async () => {
      const invalidData = {
        username: '', // Invalid empty username
        demographics: {
          ageRange: 'invalid-age-range',
          educationLevel: 'invalid-education-level'
        }
      };

      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should require authentication for profile access', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });
  });

  describe('Learning Preferences Management', () => {
    it('should update learning preferences successfully', async () => {
      const preferencesData = {
        learningStyle: [LearningStyle.AUDITORY, LearningStyle.READING],
        preferredContentTypes: [ContentType.PODCAST, ContentType.TEXT],
        sessionDuration: 90,
        difficultyPreference: 'challenging' as const
      };

      const response = await request(app)
        .put('/api/v1/users/learning-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(preferencesData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Learning preferences updated successfully');
      expect(response.body.data.learningPreferences.sessionDuration).toBe(90);
      expect(response.body.data.learningPreferences.difficultyPreference).toBe('challenging');
    });

    it('should get current learning preferences', async () => {
      const response = await request(app)
        .get('/api/v1/users/learning-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('learningStyle');
      expect(response.body.data).toHaveProperty('preferredContentTypes');
      expect(response.body.data).toHaveProperty('sessionDuration');
      expect(response.body.data).toHaveProperty('difficultyPreference');
    });

    it('should validate learning preferences data', async () => {
      const invalidPreferences = {
        learningStyle: ['invalid-style'],
        preferredContentTypes: ['invalid-type'],
        sessionDuration: -10, // Invalid negative duration
        difficultyPreference: 'invalid-preference'
      };

      const response = await request(app)
        .put('/api/v1/users/learning-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle invalid auth tokens', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });
});