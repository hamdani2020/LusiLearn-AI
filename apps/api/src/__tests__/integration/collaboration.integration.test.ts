import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { authRouter } from '../../routes/auth';
import createCollaborationRoutes from '../../routes/collaboration.routes';
import { setupSecurityMiddleware } from '../../middleware/security';
import { errorHandler } from '../../middleware/error-handler';
import { monitoringMiddleware } from '../../middleware/monitoring';
import { db } from '../../database/connection';
import { 
  AgeRange, 
  EducationLevel, 
  LearningStyle, 
  ContentType,
  ModerationLevel,
  PrivacyLevel,
  CollaborationActivityType
} from '@lusilearn/shared-types';

// Mock logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock collaboration service
jest.mock('../../services/collaboration.service', () => {
  return {
    CollaborationService: jest.fn().mockImplementation(() => ({
      matchPeers: jest.fn().mockResolvedValue([
        {
          userId: 'peer-user-1',
          compatibilityScore: 85,
          sharedInterests: ['javascript', 'web-development'],
          complementarySkills: ['frontend', 'backend'],
          matchReason: 'Similar learning goals and complementary skills',
          estimatedCollaborationSuccess: 80
        },
        {
          userId: 'peer-user-2',
          compatibilityScore: 78,
          sharedInterests: ['programming', 'algorithms'],
          complementarySkills: ['problem-solving', 'debugging'],
          matchReason: 'Strong technical compatibility',
          estimatedCollaborationSuccess: 75
        }
      ]),
      createStudyGroup: jest.fn().mockResolvedValue({
        id: 'study-group-123',
        name: 'JavaScript Study Group',
        description: 'Learning JavaScript together',
        topic: 'JavaScript Fundamentals',
        subject: 'programming',
        participants: [
          {
            userId: 'test-user-id',
            role: 'admin',
            joinedAt: new Date(),
            isActive: true,
            contributionScore: 100
          }
        ],
        settings: {
          maxSize: 6,
          ageRestrictions: [AgeRange.YOUNG_ADULT],
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC,
          requiresApproval: false
        },
        activities: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      getUserStudyGroups: jest.fn().mockResolvedValue([
        {
          id: 'study-group-123',
          name: 'JavaScript Study Group',
          topic: 'JavaScript Fundamentals',
          participantCount: 3,
          isActive: true
        }
      ]),
      getStudyGroup: jest.fn().mockResolvedValue({
        id: 'study-group-123',
        name: 'JavaScript Study Group',
        description: 'Learning JavaScript together',
        participants: [
          {
            userId: 'test-user-id',
            role: 'admin',
            joinedAt: new Date(),
            isActive: true,
            contributionScore: 100
          }
        ],
        activities: [],
        isActive: true
      }),
      addParticipant: jest.fn().mockResolvedValue({
        id: 'study-group-123',
        participants: [
          {
            userId: 'test-user-id',
            role: 'admin',
            joinedAt: new Date(),
            isActive: true,
            contributionScore: 100
          },
          {
            userId: 'new-participant-id',
            role: 'member',
            joinedAt: new Date(),
            isActive: true,
            contributionScore: 0
          }
        ]
      }),
      createGroupActivity: jest.fn().mockResolvedValue({
        id: 'activity-123',
        type: CollaborationActivityType.STUDY_SESSION,
        title: 'JavaScript Fundamentals Session',
        description: 'Group study session on JavaScript basics',
        participants: ['test-user-id', 'peer-user-1'],
        startTime: new Date(),
        endTime: null,
        isCompleted: false
      }),
      moderateInteraction: jest.fn().mockResolvedValue({
        isAppropriate: true,
        flaggedContent: [],
        severity: 'low',
        action: 'none',
        reason: 'Content is appropriate'
      }),
      facilitateSession: jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        groupId: 'study-group-123',
        participants: ['test-user-id', 'peer-user-1'],
        topic: 'JavaScript Fundamentals',
        startTime: new Date(),
        isActive: true
      })
    }))
  };
});

describe('Collaboration API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let authToken: string;
  let otherUser: any;
  let otherUserToken: string;

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

    // Setup routes
    app.use('/api/v1/auth', authRouter);
    app.use('/api/v1/collaboration', createCollaborationRoutes(testDb));
    app.use(errorHandler);

    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
    
    // Create and authenticate test users
    await createTestUsers();
  });

  const cleanupTestData = async () => {
    try {
      await testDb.query('DELETE FROM collaboration_activities WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await testDb.query('DELETE FROM study_group_participants WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%test%']);
      await testDb.query('DELETE FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await testDb.query('DELETE FROM peer_matches WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await testDb.query('DELETE FROM collaboration_session_data WHERE session_id LIKE $1', ['%test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUsers = async () => {
    // Create first test user
    const userData1 = {
      email: 'collaboration.test1@example.com',
      password: 'TestPassword123!',
      username: 'collaborationtest1',
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
    };

    const registerResponse1 = await request(app)
      .post('/api/v1/auth/register')
      .send(userData1);
    
    testUser = registerResponse1.body.data.user;
    authToken = registerResponse1.body.data.accessToken;

    // Create second test user
    const userData2 = {
      email: 'collaboration.test2@example.com',
      password: 'TestPassword123!',
      username: 'collaborationtest2',
      demographics: {
        ageRange: AgeRange.YOUNG_ADULT,
        educationLevel: EducationLevel.COLLEGE,
        timezone: 'America/New_York',
        preferredLanguage: 'en'
      },
      learningPreferences: {
        learningStyle: [LearningStyle.AUDITORY, LearningStyle.READING],
        preferredContentTypes: [ContentType.PODCAST, ContentType.TEXT],
        sessionDuration: 45,
        difficultyPreference: 'challenging' as const
      }
    };

    const registerResponse2 = await request(app)
      .post('/api/v1/auth/register')
      .send(userData2);
    
    otherUser = registerResponse2.body.data.user;
    otherUserToken = registerResponse2.body.data.accessToken;
  };

  describe('Peer Matching', () => {
    it('should find peer matches successfully', async () => {
      const matchingCriteria = {
        subjects: ['javascript', 'web-development'],
        skillLevels: ['beginner', 'intermediate'],
        learningGoals: ['build-projects', 'learn-frameworks'],
        timeZone: 'America/New_York',
        ageRange: AgeRange.YOUNG_ADULT,
        communicationStyle: 'casual' as const,
        collaborationType: 'study_buddy' as const
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchingCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matches).toBeInstanceOf(Array);
      expect(response.body.data.count).toBeDefined();

      if (response.body.data.matches.length > 0) {
        const firstMatch = response.body.data.matches[0];
        expect(firstMatch).toHaveProperty('userId');
        expect(firstMatch).toHaveProperty('compatibilityScore');
        expect(firstMatch).toHaveProperty('sharedInterests');
        expect(firstMatch).toHaveProperty('complementarySkills');
        expect(firstMatch).toHaveProperty('matchReason');
        expect(firstMatch).toHaveProperty('estimatedCollaborationSuccess');
        expect(firstMatch.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(firstMatch.compatibilityScore).toBeLessThanOrEqual(100);
      }
    });

    it('should reject peer matching without authentication', async () => {
      const matchingCriteria = {
        subjects: ['javascript'],
        skillLevels: ['beginner'],
        learningGoals: ['learn-basics'],
        collaborationType: 'study_buddy' as const
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .send(matchingCriteria)
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });

    it('should reject peer matching with invalid criteria', async () => {
      const invalidCriteria = {
        subjects: [], // Empty subjects array
        skillLevels: ['invalid-level'],
        learningGoals: [],
        collaborationType: 'invalid-type' as any
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCriteria)
        .expect(400);

      expect(response.body.error).toBe('Invalid request data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Study Group Management', () => {
    it('should create a study group successfully', async () => {
      const groupData = {
        name: 'JavaScript Beginners',
        description: 'A study group for learning JavaScript fundamentals',
        topic: 'JavaScript Fundamentals',
        subject: 'programming',
        maxSize: 6,
        ageRestrictions: [AgeRange.YOUNG_ADULT, AgeRange.ADULT],
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(groupData.name);
      expect(response.body.data.description).toBe(groupData.description);
      expect(response.body.data.topic).toBe(groupData.topic);
      expect(response.body.data.participants).toBeInstanceOf(Array);
      expect(response.body.data.participants.length).toBeGreaterThan(0);
      expect(response.body.data.settings.maxSize).toBe(groupData.maxSize);
      expect(response.body.data.settings.moderationLevel).toBe(groupData.moderationLevel);
    });

    it('should get user study groups', async () => {
      const response = await request(app)
        .get('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toBeInstanceOf(Array);
      expect(response.body.data.count).toBeDefined();
    });

    it('should get specific study group details', async () => {
      const groupId = 'study-group-123';

      const response = await request(app)
        .get(`/api/v1/collaboration/study-groups/${groupId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data).toHaveProperty('activities');
    });

    it('should reject study group creation without authentication', async () => {
      const groupData = {
        name: 'Test Group',
        description: 'Test description',
        topic: 'Test Topic',
        subject: 'test',
        maxSize: 4,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .send(groupData)
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });

    it('should reject study group creation with invalid data', async () => {
      const invalidGroupData = {
        name: '', // Empty name
        description: 'A' * 1000, // Too long description
        topic: '',
        subject: '',
        maxSize: 15, // Exceeds maximum
        moderationLevel: 'invalid' as any,
        privacy: 'invalid' as any
      };

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidGroupData)
        .expect(400);

      expect(response.body.error).toBe('Invalid request data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Study Group Participation', () => {
    it('should add participant to study group', async () => {
      const groupId = 'study-group-123';
      const participantData = {
        userId: otherUser.id
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${groupId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(participantData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data.participants.length).toBeGreaterThan(1);
    });

    it('should reject adding participant without user ID', async () => {
      const groupId = 'study-group-123';

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${groupId}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('User ID is required');
    });
  });

  describe('Group Activities', () => {
    it('should create group activity successfully', async () => {
      const groupId = 'study-group-123';
      const activityData = {
        type: CollaborationActivityType.STUDY_SESSION,
        title: 'JavaScript Fundamentals Session',
        description: 'Group study session covering JavaScript basics',
        participants: [testUser.id, otherUser.id],
        startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        endTime: new Date(Date.now() + 7200000).toISOString() // 2 hours from now
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.type).toBe(activityData.type);
      expect(response.body.data.title).toBe(activityData.title);
      expect(response.body.data.participants).toBeInstanceOf(Array);
    });

    it('should reject activity creation with invalid data', async () => {
      const groupId = 'study-group-123';
      const invalidActivityData = {
        type: 'invalid-type' as any,
        title: '', // Empty title
        description: 'A' * 1500, // Too long description
        participants: [], // Empty participants
        startTime: 'invalid-date',
        endTime: 'invalid-date'
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${groupId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidActivityData)
        .expect(400);

      expect(response.body.error).toBe('Invalid activity data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Content Moderation', () => {
    it('should moderate interaction content', async () => {
      const interactionId = 'interaction-123';

      const response = await request(app)
        .post(`/api/v1/collaboration/moderation/${interactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isAppropriate');
      expect(response.body.data).toHaveProperty('severity');
      expect(response.body.data).toHaveProperty('action');
      expect(response.body.data).toHaveProperty('reason');
    });
  });

  describe('Collaboration Sessions', () => {
    it('should create collaboration session successfully', async () => {
      const sessionData = {
        groupId: 'study-group-123',
        topic: 'JavaScript Fundamentals',
        participants: [testUser.id, otherUser.id],
        duration: 60
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('topic');
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data).toHaveProperty('startTime');
      expect(response.body.data).toHaveProperty('websocketUrl');
      expect(response.body.data.topic).toBe(sessionData.topic);
      expect(response.body.data.participants).toEqual(sessionData.participants);
    });

    it('should get collaboration session details', async () => {
      const sessionId = 'session-123';

      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('participants');
      expect(response.body.data).toHaveProperty('topic');
    });

    it('should get session progress updates', async () => {
      const sessionId = 'session-123';

      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('progressUpdates');
      expect(response.body.data.progressUpdates).toBeInstanceOf(Array);
    });

    it('should get session shared files', async () => {
      const sessionId = 'session-123';

      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('sharedFiles');
      expect(response.body.data.sharedFiles).toBeInstanceOf(Array);
    });

    it('should end collaboration session successfully', async () => {
      const sessionId = 'session-123';
      const endData = {
        outcomes: ['Completed JavaScript basics review', 'Planned next study session'],
        satisfaction: 4,
        feedback: 'Great collaborative session, learned a lot!'
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('endTime');
      expect(response.body.data).toHaveProperty('message');
    });

    it('should reject session creation with invalid data', async () => {
      const invalidSessionData = {
        topic: '', // Empty topic
        participants: [], // Empty participants
        duration: -1 // Invalid duration
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidSessionData)
        .expect(400);

      expect(response.body.error).toBe('Invalid session data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Access Control and Security', () => {
    it('should prevent unauthorized access to other users sessions', async () => {
      const sessionId = 'session-123';

      // Mock the facilitateSession to return a session without the other user
      const { CollaborationService } = require('../../services/collaboration.service');
      const originalFacilitateSession = CollaborationService.prototype.facilitateSession;
      CollaborationService.prototype.facilitateSession = jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        participants: ['different-user-id'], // Other user not in participants
        topic: 'Private Session'
      });

      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied to this session');

      // Restore original method
      CollaborationService.prototype.facilitateSession = originalFacilitateSession;
    });

    it('should prevent unauthorized access to study groups', async () => {
      const groupId = 'private-group-123';

      // Mock getStudyGroup to return null (group not found or no access)
      const { CollaborationService } = require('../../services/collaboration.service');
      const originalGetStudyGroup = CollaborationService.prototype.getStudyGroup;
      CollaborationService.prototype.getStudyGroup = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/collaboration/study-groups/${groupId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.error).toBe('Study group not found');

      // Restore original method
      CollaborationService.prototype.getStudyGroup = originalGetStudyGroup;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service unavailability gracefully', async () => {
      // Mock service failure
      const { CollaborationService } = require('../../services/collaboration.service');
      const originalMatchPeers = CollaborationService.prototype.matchPeers;
      CollaborationService.prototype.matchPeers = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const matchingCriteria = {
        subjects: ['javascript'],
        skillLevels: ['beginner'],
        learningGoals: ['learn-basics'],
        collaborationType: 'study_buddy' as const
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchingCriteria)
        .expect(500);

      expect(response.body.error).toBe('Failed to find peer matches');

      // Restore original method
      CollaborationService.prototype.matchPeers = originalMatchPeers;
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should enforce rate limiting on collaboration endpoints', async () => {
      const matchingCriteria = {
        subjects: ['test'],
        skillLevels: ['beginner'],
        learningGoals: ['test'],
        collaborationType: 'study_buddy' as const
      };

      // Make multiple rapid requests
      const requests = Array(30).fill(null).map(() =>
        request(app)
          .post('/api/v1/collaboration/peer-matching')
          .set('Authorization', `Bearer ${authToken}`)
          .send(matchingCriteria)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Age-Appropriate Collaboration', () => {
    it('should handle minor user collaboration with restrictions', async () => {
      // Create a minor user
      const minorUserData = {
        email: 'minor.collaboration.test@example.com',
        password: 'TestPassword123!',
        username: 'minorcollaborationtest',
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
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(minorUserData);
      
      const minorToken = registerResponse.body.data.accessToken;

      // Test peer matching for minor user
      const matchingCriteria = {
        subjects: ['math'],
        skillLevels: ['beginner'],
        learningGoals: ['homework-help'],
        ageRange: AgeRange.TEEN,
        collaborationType: 'study_buddy' as const
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${minorToken}`)
        .send(matchingCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.matches).toBeInstanceOf(Array);
      
      // In a real implementation, this would verify age-appropriate matching
      // For now, we just verify the endpoint works with minor users
    });
  });

  describe('Real-time Collaboration Features', () => {
    it('should handle WebSocket connection information', async () => {
      const sessionData = {
        topic: 'Real-time JavaScript Study',
        participants: [testUser.id, otherUser.id]
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('websocketUrl');
      expect(response.body.data.websocketUrl).toContain('ws://');
      expect(response.body.data.websocketUrl).toContain('sessionId=');
    });
  });
});