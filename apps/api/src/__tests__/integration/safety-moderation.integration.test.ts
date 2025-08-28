import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { safetyModerationRouter } from '../../routes/safety-moderation.routes';
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

describe('Safety and Moderation API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let minorUser: any;
  let authToken: string;
  let minorToken: string;
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
    app.use('/api/v1/safety', safetyModerationRouter);
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
    
    // Create test users and get auth tokens
    const userData = createTestUserData();
    const minorUserData = createMinorUserData();
    
    testUser = await createTestUser(userData);
    minorUser = await createTestUser(minorUserData);
    
    authToken = await generateAuthToken(testUser.id);
    minorToken = await generateAuthToken(minorUser.id);
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM safety_reports WHERE reported_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%safety.test%']);
      await testDb.query('DELETE FROM moderation_actions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%safety.test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%safety.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = () => ({
    email: 'safety.test@example.com',
    password: 'TestPassword123!',
    username: 'safetytest',
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

  const createMinorUserData = () => ({
    email: 'minor.safety.test@example.com',
    password: 'TestPassword123!',
    username: 'minorsafetytest',
    demographics: {
      ageRange: AgeRange.TEEN,
      educationLevel: EducationLevel.K12,
      timezone: 'America/New_York',
      preferredLanguage: 'en'
    },
    learningPreferences: {
      learningStyle: [LearningStyle.VISUAL],
      preferredContentTypes: [ContentType.VIDEO],
      sessionDuration: 30,
      difficultyPreference: 'gradual' as const
    },
    parentalControls: {
      parentEmail: 'parent@example.com',
      restrictedInteractions: true,
      contentFiltering: 'strict' as const,
      timeRestrictions: {
        dailyLimit: 120,
        allowedHours: { start: '09:00', end: '17:00' }
      }
    }
  });

  const createTestUser = async (userData: any) => {
    const hashedPassword = await authService.hashPassword(userData.password);
    
    const query = `
      INSERT INTO users (email, password_hash, username, demographics, learning_preferences, parental_controls, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, username, demographics, learning_preferences, parental_controls, created_at, updated_at
    `;

    const result = await testDb.query(query, [
      userData.email,
      hashedPassword,
      userData.username,
      JSON.stringify(userData.demographics),
      JSON.stringify(userData.learningPreferences),
      JSON.stringify(userData.parentalControls || null)
    ]);

    return result.rows[0];
  };

  const generateAuthToken = async (userId: string): Promise<string> => {
    return authService.generateAccessToken(userId);
  };

  describe('Content Reporting', () => {
    it('should submit content report successfully', async () => {
      const reportData = {
        contentId: 'content-123',
        contentType: 'video',
        reason: 'inappropriate',
        category: 'offensive_language',
        description: 'Contains inappropriate language for educational content',
        severity: 'medium',
        evidence: {
          timestamp: '00:02:15',
          screenshot: 'base64-encoded-image-data'
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('submittedAt');
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.message).toBe('Content report submitted successfully');
    });

    it('should validate content report data', async () => {
      const invalidReportData = {
        contentId: '', // Invalid empty content ID
        reason: 'invalid-reason', // Invalid reason
        severity: 'invalid-severity' // Invalid severity
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidReportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should require authentication for content reporting', async () => {
      const reportData = {
        contentId: 'content-123',
        reason: 'inappropriate',
        description: 'Test report'
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/content')
        .send(reportData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });
  });

  describe('User Behavior Reporting', () => {
    it('should report inappropriate user behavior', async () => {
      const reportData = {
        reportedUserId: 'user-456',
        interactionId: 'interaction-789',
        reason: 'harassment',
        category: 'bullying',
        description: 'User was sending inappropriate messages during study session',
        severity: 'high',
        evidence: {
          messages: ['inappropriate message 1', 'inappropriate message 2'],
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data.status).toBe('submitted');
      expect(response.body.message).toBe('User behavior report submitted successfully');
    });

    it('should handle emergency safety reports with high priority', async () => {
      const emergencyReportData = {
        reportedUserId: 'user-456',
        reason: 'safety_threat',
        category: 'immediate_danger',
        description: 'User is making threats of violence',
        severity: 'critical',
        isEmergency: true,
        evidence: {
          messages: ['threatening message'],
          timestamp: new Date().toISOString()
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emergencyReportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe('critical');
      expect(response.body.data.escalated).toBe(true);
      expect(response.body.message).toContain('Emergency report');
    });

    it('should prevent self-reporting', async () => {
      const selfReportData = {
        reportedUserId: testUser.id, // Reporting themselves
        reason: 'inappropriate',
        description: 'Self report test'
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(selfReportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Cannot report yourself');
    });
  });

  describe('Content Moderation', () => {
    it('should scan content for inappropriate material', async () => {
      const contentData = {
        contentId: 'content-123',
        contentType: 'text',
        content: 'This is educational content about JavaScript programming.',
        metadata: {
          source: 'user_generated',
          targetAudience: 'general'
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/moderate/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('moderationResult');
      expect(response.body.data).toHaveProperty('approved');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('flags');
      expect(response.body.data.approved).toBe(true);
    });

    it('should flag inappropriate content', async () => {
      const inappropriateContentData = {
        contentId: 'content-456',
        contentType: 'text',
        content: 'This content contains inappropriate language and offensive material.',
        metadata: {
          source: 'user_generated',
          targetAudience: 'minors'
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/moderate/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inappropriateContentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.approved).toBe(false);
      expect(response.body.data.flags.length).toBeGreaterThan(0);
      expect(response.body.data.flags).toContain('inappropriate_language');
    });

    it('should apply stricter moderation for minor-targeted content', async () => {
      const contentData = {
        contentId: 'content-789',
        contentType: 'text',
        content: 'Educational content with mild language that might be okay for adults.',
        metadata: {
          source: 'user_generated',
          targetAudience: 'minors'
        }
      };

      const response = await request(app)
        .post('/api/v1/safety/moderate/content')
        .set('Authorization', `Bearer ${minorToken}`)
        .send(contentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should apply stricter standards for minor users
      expect(response.body.data.moderationLevel).toBe('strict');
    });
  });

  describe('Interaction Monitoring', () => {
    it('should monitor chat interactions for safety', async () => {
      const interactionData = {
        sessionId: 'session-123',
        participants: [testUser.id, 'user-456'],
        messages: [
          {
            senderId: testUser.id,
            content: 'Hi, can you help me with this JavaScript problem?',
            timestamp: new Date().toISOString()
          },
          {
            senderId: 'user-456',
            content: 'Sure! What specific part are you struggling with?',
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/safety/monitor/interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send(interactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monitoringResult');
      expect(response.body.data).toHaveProperty('safetyScore');
      expect(response.body.data).toHaveProperty('flags');
      expect(response.body.data.safetyScore).toBeGreaterThan(0.8); // Should be high for appropriate content
    });

    it('should flag inappropriate interactions', async () => {
      const inappropriateInteractionData = {
        sessionId: 'session-456',
        participants: [testUser.id, 'user-789'],
        messages: [
          {
            senderId: 'user-789',
            content: 'This message contains inappropriate content and harassment.',
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/safety/monitor/interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send(inappropriateInteractionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.safetyScore).toBeLessThan(0.5);
      expect(response.body.data.flags.length).toBeGreaterThan(0);
      expect(response.body.data.requiresReview).toBe(true);
    });

    it('should apply enhanced monitoring for minor users', async () => {
      const interactionData = {
        sessionId: 'session-789',
        participants: [minorUser.id, testUser.id],
        messages: [
          {
            senderId: testUser.id,
            content: 'Hey, want to meet up outside of the platform?',
            timestamp: new Date().toISOString()
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/safety/monitor/interaction')
        .set('Authorization', `Bearer ${minorToken}`)
        .send(interactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.monitoringLevel).toBe('enhanced');
      expect(response.body.data.flags).toContain('potential_grooming');
      expect(response.body.data.requiresReview).toBe(true);
    });
  });

  describe('Safety Settings and Controls', () => {
    it('should get user safety settings', async () => {
      const response = await request(app)
        .get('/api/v1/safety/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('contentFiltering');
      expect(response.body.data).toHaveProperty('interactionRestrictions');
      expect(response.body.data).toHaveProperty('reportingPreferences');
      expect(response.body.data).toHaveProperty('blockList');
    });

    it('should update safety settings', async () => {
      const settingsData = {
        contentFiltering: 'moderate',
        interactionRestrictions: {
          allowDirectMessages: false,
          requireMutualConnections: true,
          restrictedKeywords: ['meet', 'personal']
        },
        reportingPreferences: {
          autoReport: true,
          notifyModerators: true
        }
      };

      const response = await request(app)
        .put('/api/v1/safety/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(settingsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentFiltering).toBe('moderate');
      expect(response.body.data.interactionRestrictions.allowDirectMessages).toBe(false);
      expect(response.body.message).toBe('Safety settings updated successfully');
    });

    it('should get enhanced safety settings for minor users', async () => {
      const response = await request(app)
        .get('/api/v1/safety/settings')
        .set('Authorization', `Bearer ${minorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contentFiltering).toBe('strict'); // Default for minors
      expect(response.body.data.parentalControls).toBeDefined();
      expect(response.body.data.interactionRestrictions.restrictedInteractions).toBe(true);
    });
  });

  describe('Block and Restrict Users', () => {
    it('should block a user successfully', async () => {
      const blockData = {
        blockedUserId: 'user-456',
        reason: 'inappropriate_behavior',
        blockType: 'full' // full, interaction_only, content_only
      };

      const response = await request(app)
        .post('/api/v1/safety/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send(blockData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('blockId');
      expect(response.body.data.blockedUserId).toBe('user-456');
      expect(response.body.data.blockType).toBe('full');
      expect(response.body.message).toBe('User blocked successfully');
    });

    it('should get blocked users list', async () => {
      // First block a user
      await request(app)
        .post('/api/v1/safety/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          blockedUserId: 'user-456',
          reason: 'spam',
          blockType: 'interaction_only'
        });

      const response = await request(app)
        .get('/api/v1/safety/blocked-users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('blockedUsers');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.blockedUsers)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should unblock a user', async () => {
      // First block a user
      const blockResponse = await request(app)
        .post('/api/v1/safety/block')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          blockedUserId: 'user-789',
          reason: 'test',
          blockType: 'full'
        });

      const blockId = blockResponse.body.data.blockId;

      const response = await request(app)
        .delete(`/api/v1/safety/block/${blockId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User unblocked successfully');
    });
  });

  describe('Safety Analytics and Reporting', () => {
    it('should get safety analytics for user', async () => {
      const response = await request(app)
        .get('/api/v1/safety/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reportsSubmitted');
      expect(response.body.data).toHaveProperty('reportsReceived');
      expect(response.body.data).toHaveProperty('safetyScore');
      expect(response.body.data).toHaveProperty('moderationActions');
      expect(response.body.data).toHaveProperty('trends');
    });

    it('should get safety report status', async () => {
      // First submit a report
      const reportResponse = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: 'content-123',
          reason: 'inappropriate',
          description: 'Test report for status check'
        });

      const reportId = reportResponse.body.data.reportId;

      const response = await request(app)
        .get(`/api/v1/safety/reports/${reportId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reportId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('submittedAt');
      expect(response.body.data).toHaveProperty('lastUpdated');
    });
  });

  describe('Emergency Safety Features', () => {
    it('should handle emergency safety alerts', async () => {
      const emergencyData = {
        alertType: 'immediate_danger',
        description: 'User is in immediate danger and needs help',
        location: 'study_session_123',
        severity: 'critical'
      };

      const response = await request(app)
        .post('/api/v1/safety/emergency-alert')
        .set('Authorization', `Bearer ${authToken}`)
        .send(emergencyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alertId');
      expect(response.body.data).toHaveProperty('escalated');
      expect(response.body.data.escalated).toBe(true);
      expect(response.body.data.priority).toBe('critical');
      expect(response.body.message).toContain('Emergency alert');
    });

    it('should provide safety resources and support', async () => {
      const response = await request(app)
        .get('/api/v1/safety/resources')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('emergencyContacts');
      expect(response.body.data).toHaveProperty('supportResources');
      expect(response.body.data).toHaveProperty('reportingGuidelines');
      expect(response.body.data).toHaveProperty('safetyTips');
    });

    it('should provide age-appropriate safety resources for minors', async () => {
      const response = await request(app)
        .get('/api/v1/safety/resources')
        .set('Authorization', `Bearer ${minorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ageAppropriate).toBe(true);
      expect(response.body.data.parentalGuidance).toBeDefined();
      expect(response.body.data.emergencyContacts).toContain('parent');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed safety reports', async () => {
      const response = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle duplicate reports gracefully', async () => {
      const reportData = {
        contentId: 'content-duplicate-test',
        reason: 'inappropriate',
        description: 'Duplicate report test'
      };

      // Submit first report
      const response1 = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(201);

      // Submit duplicate report
      const response2 = await request(app)
        .post('/api/v1/safety/reports/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response2.body.message).toContain('duplicate');
    });

    it('should handle invalid user IDs in reports', async () => {
      const reportData = {
        reportedUserId: 'non-existent-user',
        reason: 'inappropriate',
        description: 'Test with invalid user ID'
      };

      const response = await request(app)
        .post('/api/v1/safety/reports/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Reported user not found');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all safety endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/safety/reports/content' },
        { method: 'get', path: '/api/v1/safety/settings' },
        { method: 'post', path: '/api/v1/safety/block' },
        { method: 'get', path: '/api/v1/safety/analytics' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    it('should deny access to other users safety data', async () => {
      // Try to access another user's safety analytics
      const response = await request(app)
        .get('/api/v1/safety/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId: minorUser.id })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied to other users safety data');
    });
  });

  describe('Rate Limiting for Safety Features', () => {
    it('should enforce rate limits on report submissions', async () => {
      const reportData = {
        contentId: 'content-rate-limit-test',
        reason: 'spam',
        description: 'Rate limit test report'
      };

      // Make multiple rapid report submissions
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/safety/reports/content')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ ...reportData, contentId: `content-${Math.random()}` })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});