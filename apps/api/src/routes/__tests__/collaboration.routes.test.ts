import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createCollaborationRoutes } from '../collaboration.routes';
import { ModerationLevel, PrivacyLevel } from '@lusilearn/shared-types';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
} as unknown as Pool;

// Mock fetch for AI service calls
global.fetch = jest.fn();

// Mock the auth middleware module
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

describe('Collaboration Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.use('/api/v1/collaboration', createCollaborationRoutes(mockPool));
    jest.clearAllMocks();
  });

  describe('POST /api/v1/collaboration/peer-matching', () => {
    it('should find peer matches successfully', async () => {
      // Mock database queries for user profile and preferences
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'college', ageRange: '18-25' },
            learning_preferences: {}
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            available_hours: {
              monday: ['09:00-17:00'],
              tuesday: ['09:00-17:00']
            }
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            communication_style: 'mixed'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Store peer match

      // Mock AI service failure to trigger fallback
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .send({
          subjects: ['mathematics', 'programming'],
          skillLevels: ['beginner', 'intermediate'],
          learningGoals: ['learn algorithms'],
          collaborationType: 'study_buddy'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.matches).toBeDefined();
      expect(Array.isArray(response.body.data.matches)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should return 400 for invalid request data', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/peer-matching')
        .send({
          // Missing required fields
          subjects: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request data');
    });
  });

  describe('POST /api/v1/collaboration/study-groups', () => {
    it('should create study group successfully', async () => {
      // Mock database insert
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'group-id',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .send({
          name: 'Math Study Group',
          description: 'A group for learning mathematics',
          topic: 'Algebra',
          subject: 'Mathematics',
          maxSize: 6,
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('group-id');
      expect(response.body.data.name).toBe('Math Study Group');
    });

    it('should return 400 for invalid group data', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/study-groups')
        .send({
          name: '', // Invalid: empty name
          description: 'A group for learning mathematics',
          topic: 'Algebra',
          subject: 'Mathematics',
          maxSize: 6,
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request data');
    });
  });

  describe('GET /api/v1/collaboration/study-groups', () => {
    it('should get user study groups successfully', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Math Group',
          description: 'Math study group',
          topic: 'Algebra',
          subject: 'Mathematics',
          participants: [],
          settings: {},
          activities: [],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockGroups
      });

      const response = await request(app)
        .get('/api/v1/collaboration/study-groups');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toBeDefined();
      expect(response.body.data.count).toBe(1);
    });
  });

  describe('GET /api/v1/collaboration/study-groups/:groupId', () => {
    it('should get specific study group successfully', async () => {
      const mockGroup = {
        id: 'group-id',
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: [{ userId: 'test-user-id', role: 'admin' }],
        settings: {},
        activities: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockGroup]
      });

      const response = await request(app)
        .get('/api/v1/collaboration/study-groups/group-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('group-id');
    });

    it('should return 404 for non-existent group', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/api/v1/collaboration/study-groups/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Study group not found');
    });

    it('should return 403 for non-participant access', async () => {
      const mockGroup = {
        id: 'group-id',
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: [{ userId: 'other-user-id', role: 'admin' }], // Different user
        settings: {},
        activities: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockGroup]
      });

      const response = await request(app)
        .get('/api/v1/collaboration/study-groups/group-id');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied to this study group');
    });
  });

  describe('POST /api/v1/collaboration/study-groups/:groupId/participants', () => {
    it('should add participant successfully', async () => {
      const mockGroup = {
        id: 'group-id',
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: [{
          userId: 'test-user-id',
          role: 'admin',
          joinedAt: new Date(),
          isActive: true,
          contributionScore: 0
        }],
        settings: {
          maxSize: 8,
          ageRestrictions: [],
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC,
          requiresApproval: false
        },
        activities: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock get study group and update group
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: mockGroup.id,
            name: mockGroup.name,
            description: mockGroup.description,
            topic: mockGroup.topic,
            subject: mockGroup.subject,
            participants: mockGroup.participants,
            settings: mockGroup.settings,
            activities: mockGroup.activities,
            is_active: mockGroup.is_active,
            created_at: mockGroup.created_at,
            updated_at: mockGroup.updated_at
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/collaboration/study-groups/group-id/participants')
        .send({
          userId: 'new-user-id'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).toHaveLength(2);
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/study-groups/group-id/participants')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User ID is required');
    });
  });

  describe('POST /api/v1/collaboration/moderation/:interactionId', () => {
    it('should moderate interaction successfully', async () => {
      const response = await request(app)
        .post('/api/v1/collaboration/moderation/interaction-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isAppropriate');
      expect(response.body.data).toHaveProperty('severity');
      expect(response.body.data).toHaveProperty('action');
    });
  });
});