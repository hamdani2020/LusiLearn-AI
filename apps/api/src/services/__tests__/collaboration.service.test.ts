import { Pool } from 'pg';
import { CollaborationService } from '../collaboration.service';
import {
  MatchingCriteria,
  CreateStudyGroupSchema,
  ModerationLevel,
  PrivacyLevel
} from '@lusilearn/shared-types';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
} as unknown as Pool;

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('CollaborationService', () => {
  let collaborationService: CollaborationService;

  beforeEach(() => {
    collaborationService = new CollaborationService(mockPool);
    jest.clearAllMocks();
  });

  describe('matchPeers', () => {
    it('should find peer matches using AI service', async () => {
      const userId = 'test-user-id';
      const criteria: MatchingCriteria = {
        subjects: ['mathematics', 'programming'],
        skillLevels: ['beginner', 'intermediate'],
        learningGoals: ['learn algorithms'],
        collaborationType: 'study_buddy'
      };

      // Mock user profile query
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'college', ageRange: '18-25' },
            learning_preferences: {}
          }]
        })
        // Mock collaboration preferences query
        .mockResolvedValueOnce({
          rows: [{
            available_hours: {
              monday: ['09:00-17:00'],
              tuesday: ['09:00-17:00']
            }
          }]
        })
        // Mock communication preferences query
        .mockResolvedValueOnce({
          rows: [{
            communication_style: 'mixed'
          }]
        })
        // Mock store peer match query
        .mockResolvedValueOnce({ rows: [] });

      // Mock AI service response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const matches = await collaborationService.matchPeers(userId, criteria);

      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty('userId');
      expect(matches[0]).toHaveProperty('compatibilityScore');
      expect(matches[0]).toHaveProperty('sharedInterests');
    });

    it('should handle AI service failure with fallback', async () => {
      const userId = 'test-user-id';
      const criteria: MatchingCriteria = {
        subjects: ['mathematics'],
        skillLevels: ['beginner'],
        learningGoals: ['learn basics'],
        collaborationType: 'study_buddy'
      };

      // Mock user profile query
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'k12', ageRange: '13-17' },
            learning_preferences: {}
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Mock AI service failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      const matches = await collaborationService.matchPeers(userId, criteria);

      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);
      // Should use fallback mock data
      expect(matches[0].userId).toContain('mock_peer');
    });
  });

  describe('createStudyGroup', () => {
    it('should create a new study group successfully', async () => {
      const creatorId = 'creator-id';
      const groupData = {
        name: 'Math Study Group',
        description: 'A group for learning mathematics',
        topic: 'Algebra',
        subject: 'Mathematics',
        maxSize: 6,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      // Mock database insert
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'group-id',
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await collaborationService.createStudyGroup(creatorId, groupData);

      expect(result).toBeDefined();
      expect(result.id).toBe('group-id');
      expect(result.name).toBe(groupData.name);
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0].userId).toBe(creatorId);
      expect(result.participants[0].role).toBe('admin');
    });

    it('should validate group data before creation', async () => {
      const creatorId = 'creator-id';
      const invalidGroupData = {
        name: '', // Invalid: empty name
        description: 'A group for learning mathematics',
        topic: 'Algebra',
        subject: 'Mathematics',
        maxSize: 6,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      await expect(
        collaborationService.createStudyGroup(creatorId, invalidGroupData)
      ).rejects.toThrow();
    });
  });

  describe('addParticipant', () => {
    it('should add participant to study group with proper permissions', async () => {
      const groupId = 'group-id';
      const userId = 'new-user-id';
      const requesterId = 'admin-user-id';

      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: [{
          userId: requesterId,
          role: 'admin' as const,
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock get study group
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
            is_active: mockGroup.isActive,
            created_at: mockGroup.createdAt,
            updated_at: mockGroup.updatedAt
          }]
        })
        // Mock update group
        .mockResolvedValueOnce({ rows: [] });

      const result = await collaborationService.addParticipant(groupId, userId, requesterId);

      expect(result.participants).toHaveLength(2);
      expect(result.participants[1].userId).toBe(userId);
      expect(result.participants[1].role).toBe('member');
    });

    it('should reject adding participant when group is full', async () => {
      const groupId = 'group-id';
      const userId = 'new-user-id';
      const requesterId = 'admin-user-id';

      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: Array(8).fill(null).map((_, i) => ({
          userId: i === 0 ? requesterId : `user-${i}`,
          role: i === 0 ? 'admin' as const : 'member' as const,
          joinedAt: new Date(),
          isActive: true,
          contributionScore: 0
        })),
        settings: {
          maxSize: 8,
          ageRestrictions: [],
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC,
          requiresApproval: false
        },
        activities: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock get study group
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: mockGroup.id,
          name: mockGroup.name,
          description: mockGroup.description,
          topic: mockGroup.topic,
          subject: mockGroup.subject,
          participants: mockGroup.participants,
          settings: mockGroup.settings,
          activities: mockGroup.activities,
          is_active: mockGroup.isActive,
          created_at: mockGroup.createdAt,
          updated_at: mockGroup.updatedAt
        }]
      });

      await expect(
        collaborationService.addParticipant(groupId, userId, requesterId)
      ).rejects.toThrow('Group is full');
    });
  });

  describe('moderateInteraction', () => {
    it('should return moderation result', async () => {
      const interactionId = 'interaction-id';

      const result = await collaborationService.moderateInteraction(interactionId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('isAppropriate');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('action');
    });
  });

  describe('getStudyGroup', () => {
    it('should retrieve study group by ID', async () => {
      const groupId = 'group-id';
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        participants: [],
        settings: {},
        activities: [],
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockGroup]
      });

      const result = await collaborationService.getStudyGroup(groupId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(groupId);
      expect(result?.name).toBe('Test Group');
    });

    it('should return null for non-existent group', async () => {
      const groupId = 'non-existent-id';

      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const result = await collaborationService.getStudyGroup(groupId);

      expect(result).toBeNull();
    });
  });
});