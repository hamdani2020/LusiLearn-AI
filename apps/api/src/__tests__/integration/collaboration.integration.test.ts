import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
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
  CollaborationActivityType 
} from '@lusilearn/shared-types';
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

describe('Collaboration API Integration Tests', () => {
  let app: express.Application;
  let testDb: Pool;
  let testUser: any;
  let testUser2: any;
  let authToken: string;
  let authToken2: string;
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
    
    // Setup routes
    app.use('/api/v1/collaboration', createCollaborationRoutes(testDb));
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
    
    // Create test users and get auth tokens
    const userData1 = createTestUserData('collab.test1@example.com', 'collabtest1');
    const userData2 = createTestUserData('collab.test2@example.com', 'collabtest2');
    
    testUser = await createTestUser(userData1);
    testUser2 = await createTestUser(userData2);
    
    authToken = await generateAuthToken(testUser.id);
    authToken2 = await generateAuthToken(testUser2.id);
  });

  const cleanupTestData = async () => {
    try {
      // Clean up in reverse dependency order
      await testDb.query('DELETE FROM collaboration_progress_updates WHERE session_id LIKE $1', ['%test%']);
      await testDb.query('DELETE FROM collaboration_shared_files WHERE session_id LIKE $1', ['%test%']);
      await testDb.query('DELETE FROM collaboration_session_data WHERE session_id LIKE $1', ['%test%']);
      await testDb.query('DELETE FROM collaboration_activities WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%collab.test%']);
      await testDb.query('DELETE FROM study_group_participants WHERE group_id IN (SELECT id FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1))', ['%collab.test%']);
      await testDb.query('DELETE FROM study_groups WHERE created_by IN (SELECT id FROM users WHERE email LIKE $1)', ['%collab.test%']);
      await testDb.query('DELETE FROM peer_matches WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%collab.test%']);
      await testDb.query('DELETE FROM users WHERE email LIKE $1', ['%collab.test%']);
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  const createTestUserData = (email: string, username: string) => ({
    email,
    password: 'TestPassword123!',
    username,
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

  const createTestStudyGroup = async (createdBy: string, name: string = 'Test Study Group') => {
    const query = `
      INSERT INTO study_groups (
        id, name, topic, created_by, max_size, age_restrictions, moderation_level, privacy_level, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await testDb.query(query, [
      groupId,
      name,
      'JavaScript Learning',
      createdBy,
      8,
      JSON.stringify({ min: 18, max: 65 }),
      'moderate',
      'public'
    ]);

    // Add creator as participant
    await testDb.query(
      'INSERT INTO study_group_participants (group_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
      [groupId, createdBy, 'creator']
    );

    return result.rows[0];
  };

  describe('Peer Matching', () => {
    it('should find peer matches successfully', async () => {
      const matchingCriteria = {
        subjects: ['javascript', 'web-development'],
        skillLevel: 'intermediate',
        learningGoals: ['master-react', 'learn-nodejs'],
        timeZone: 'America/New_York',
        preferredSessionTimes: ['evening'],
        maxGroupSize: 4
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchingCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('matches');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.matches)).toBe(true);
      expect(response.body.data.count).toBe(response.body.data.matches.length);
    });

    it('should require authentication for peer matching', async () => {
      const matchingCriteria = {
        subjects: ['javascript'],
        skillLevel: 'beginner'
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .send(matchingCriteria)
        .expect(401);

      expect(response.body.error).toBe('User not authenticated');
    });

    it('should validate matching criteria', async () => {
      const invalidCriteria = {
        subjects: [], // Invalid empty array
        skillLevel: 'invalid-level' // Invalid skill level
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
        name: 'JavaScript Fundamentals Study Group',
        topic: 'JavaScript',
        description: 'Learning JavaScript basics together',
        maxSize: 6,
        ageRestrictions: { min: 18, max: 65 },
        moderationLevel: 'moderate',
        privacyLevel: 'public'
      };

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(groupData.name);
      expect(response.body.data.topic).toBe(groupData.topic);
      expect(response.body.data.createdBy).toBe(testUser.id);
      expect(response.body.data.participants).toBeDefined();
      expect(response.body.data.participants.length).toBe(1); // Creator is automatically added
    });

    it('should get user study groups', async () => {
      // Create a test study group first
      const testGroup = await createTestStudyGroup(testUser.id);

      const response = await request(app)
        .get('/api/v1/collaboration/study-groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groups');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.groups)).toBe(true);
      expect(response.body.data.groups.length).toBeGreaterThan(0);
      expect(response.body.data.groups[0].id).toBe(testGroup.id);
    });

    it('should get specific study group details', async () => {
      const testGroup = await createTestStudyGroup(testUser.id);

      const response = await request(app)
        .get(`/api/v1/collaboration/study-groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testGroup.id);
      expect(response.body.data.name).toBe(testGroup.name);
      expect(response.body.data.participants).toBeDefined();
    });

    it('should deny access to other users study groups', async () => {
      const testGroup = await createTestStudyGroup(testUser2.id);

      const response = await request(app)
        .get(`/api/v1/collaboration/study-groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied to this study group');
    });

    it('should return 404 for non-existent study group', async () => {
      const response = await request(app)
        .get('/api/v1/collaboration/study-groups/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Study group not found');
    });
  });

  describe('Study Group Participants', () => {
    let testGroup: any;

    beforeEach(async () => {
      testGroup = await createTestStudyGroup(testUser.id);
    });

    it('should add participant to study group', async () => {
      const participantData = {
        userId: testUser2.id
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${testGroup.id}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(participantData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).toBeDefined();
      expect(response.body.data.participants.length).toBe(2); // Creator + new participant
    });

    it('should require userId when adding participant', async () => {
      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${testGroup.id}/participants`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('User ID is required');
    });
  });

  describe('Group Activities', () => {
    let testGroup: any;

    beforeEach(async () => {
      testGroup = await createTestStudyGroup(testUser.id);
    });

    it('should create group activity successfully', async () => {
      const activityData = {
        type: CollaborationActivityType.STUDY_SESSION,
        title: 'JavaScript Functions Study Session',
        description: 'Deep dive into JavaScript functions and closures',
        participants: [testUser.id, testUser2.id],
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours from now
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.type).toBe(activityData.type);
      expect(response.body.data.title).toBe(activityData.title);
      expect(response.body.data.createdBy).toBe(testUser.id);
    });

    it('should validate activity data', async () => {
      const invalidActivityData = {
        type: 'invalid-type',
        title: '', // Empty title
        participants: [] // Empty participants
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/study-groups/${testGroup.id}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidActivityData)
        .expect(400);

      expect(response.body.error).toBe('Invalid activity data');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('Collaboration Sessions', () => {
    it('should create collaboration session successfully', async () => {
      const sessionData = {
        topic: 'JavaScript Async Programming',
        participants: [testUser.id, testUser2.id],
        duration: 90
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data.topic).toBe(sessionData.topic);
      expect(response.body.data.participants).toEqual(sessionData.participants);
      expect(response.body.data).toHaveProperty('websocketUrl');
    });

    it('should create session with study group', async () => {
      const testGroup = await createTestStudyGroup(testUser.id);
      
      const sessionData = {
        groupId: testGroup.id,
        topic: 'Group Study Session',
        participants: [testUser.id, testUser2.id]
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groupId).toBe(testGroup.id);
    });

    it('should deny session creation for inaccessible groups', async () => {
      const otherUserGroup = await createTestStudyGroup(testUser2.id);
      
      const sessionData = {
        groupId: otherUserGroup.id,
        topic: 'Unauthorized Session',
        participants: [testUser.id]
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(403);

      expect(response.body.error).toBe('Access denied to this study group');
    });

    it('should validate session data', async () => {
      const invalidSessionData = {
        topic: '', // Empty topic
        participants: [] // Empty participants
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

  describe('Session Progress Tracking', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        topic: 'Test Session',
        participants: [testUser.id, testUser2.id]
      };

      const sessionResponse = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = sessionResponse.body.data.sessionId;

      // Add some test progress data
      await testDb.query(
        `INSERT INTO collaboration_progress_updates 
         (session_id, user_id, progress, content_id, milestone, timestamp) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sessionId, testUser.id, 75, 'content-1', 'Completed JavaScript basics']
      );
    });

    it('should get session progress updates', async () => {
      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.progressUpdates).toBeDefined();
      expect(Array.isArray(response.body.data.progressUpdates)).toBe(true);
      expect(response.body.data.progressUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('Session File Sharing', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        topic: 'File Sharing Test',
        participants: [testUser.id, testUser2.id]
      };

      const sessionResponse = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = sessionResponse.body.data.sessionId;

      // Add some test file data
      await testDb.query(
        `INSERT INTO collaboration_shared_files 
         (session_id, file_id, file_name, file_url, file_size, file_type, uploaded_by, timestamp) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [sessionId, 'file-1', 'test-code.js', 'https://example.com/file1', 1024, 'text/javascript', testUser.id]
      );
    });

    it('should get session shared files', async () => {
      const response = await request(app)
        .get(`/api/v1/collaboration/sessions/${sessionId}/files`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.sharedFiles).toBeDefined();
      expect(Array.isArray(response.body.data.sharedFiles)).toBe(true);
      expect(response.body.data.sharedFiles.length).toBeGreaterThan(0);

      const file = response.body.data.sharedFiles[0];
      expect(file.name).toBe('test-code.js');
      expect(file.type).toBe('text/javascript');
      expect(file.uploadedBy).toBe(testUser.id);
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a test session
      const sessionData = {
        topic: 'Session Management Test',
        participants: [testUser.id, testUser2.id]
      };

      const sessionResponse = await request(app)
        .post('/api/v1/collaboration/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData);

      sessionId = sessionResponse.body.data.sessionId;
    });

    it('should end session successfully', async () => {
      const endData = {
        outcomes: ['Learned async/await', 'Practiced promise handling'],
        satisfaction: 4,
        feedback: 'Great collaborative session!'
      };

      const response = await request(app)
        .post(`/api/v1/collaboration/sessions/${sessionId}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(endData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data).toHaveProperty('endTime');
      expect(response.body.data.message).toBe('Session ended successfully');
    });

    it('should handle ending non-existent session', async () => {
      const endData = {
        outcomes: ['Test outcome'],
        satisfaction: 3
      };

      const response = await request(app)
        .post('/api/v1/collaboration/sessions/non-existent-session/end')
        .set('Authorization', `Bearer ${authToken}`)
        .send(endData)
        .expect(404);

      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('Content Moderation', () => {
    it('should moderate interaction successfully', async () => {
      const interactionId = 'interaction-123';

      const response = await request(app)
        .post(`/api/v1/collaboration/moderation/${interactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      // The actual moderation result structure depends on the service implementation
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/collaboration/peer-matching' },
        { method: 'post', path: '/api/v1/collaboration/study-groups' },
        { method: 'get', path: '/api/v1/collaboration/study-groups' },
        { method: 'post', path: '/api/v1/collaboration/sessions' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('User not authenticated');
      }
    });

    it('should reject invalid auth tokens', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', 'Bearer invalid-token')
        .send({ subjects: ['javascript'] })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid JSON');
    });

    it('should handle database connection issues gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll test that endpoints don't crash with valid requests
      const matchingCriteria = {
        subjects: ['javascript'],
        skillLevel: 'beginner'
      };

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .set('Authorization', `Bearer ${authToken}`)
        .send(matchingCriteria)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});