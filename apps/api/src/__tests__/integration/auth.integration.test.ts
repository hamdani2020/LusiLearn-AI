import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { authRouter } from '../../routes/auth';
import { userRouter } from '../../routes/user';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { AgeRange, EducationLevel, LearningStyle, ContentType } from '@lusilearn/shared-types';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Authentication API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;

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

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
      await testDb.query('DELETE FROM learning_paths WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'integration.test@example.com',
    password: 'TestPassword123!',
    username: 'integrationtest',
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

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const userData = createTestUserData();

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);

      // Store for cleanup
      testUser = response.body.data.user;
      authToken = response.body.data.accessToken;
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        ...createTestUserData(),
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        ...createTestUserData(),
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should reject duplicate email registration', async () => {
      const userData = createTestUserData();

      // First registration should succeed
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email should fail
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Register a user for login tests
      const userData = createTestUserData();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      testUser = registerResponse.body.data.user;
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'integration.test@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(loginData.email);

      authToken = response.body.data.accessToken;
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'integration.test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });
  });

  describe('Token Management', () => {
    beforeEach(async () => {
      // Register and login a user
      const userData = createTestUserData();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      testUser = registerResponse.body.data.user;
      authToken = registerResponse.body.data.accessToken;
    });

    it('should get current user info with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });
  });

  describe('Password Management', () => {
    beforeEach(async () => {
      // Register and login a user
      const userData = createTestUserData();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      testUser = registerResponse.body.data.user;
      authToken = registerResponse.body.data.accessToken;
    });

    it('should change password with valid current password', async () => {
      const changePasswordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewTestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify old password no longer works
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(401);

      expect(loginResponse.body.success).toBe(false);

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'NewTestPassword123!'
        })
        .expect(200);

      expect(newLoginResponse.body.success).toBe(true);
    });

    it('should reject password change with wrong current password', async () => {
      const changePasswordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewTestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should handle forgot password request', async () => {
      const forgotPasswordData = {
        email: testUser.email
      };

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link has been sent');
    });
  });

  describe('User Profile Management Integration', () => {
    beforeEach(async () => {
      // Register and login a user
      const userData = createTestUserData();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      testUser = registerResponse.body.data.user;
      authToken = registerResponse.body.data.accessToken;
    });

    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data.demographics).toBeDefined();
      expect(response.body.data.learningPreferences).toBeDefined();
    });

    it('should update user profile', async () => {
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

    it('should update learning preferences', async () => {
      const preferencesData = {
        learningStyle: [LearningStyle.AUDITORY],
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
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!'
      };

      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });
});