import { Pool } from 'pg';
import { CollaborationService } from '../collaboration.service';
import { SafetyModerationService } from '../safety-moderation.service';
import {
  MatchingCriteria,
  CreateStudyGroupSchema,
  ModerationLevel,
  PrivacyLevel,
  PeerMatch,
  StudyGroup,
  CollaborationActivityType,
  SafetyReportType,
  SafetyCategory,
  AgeRange
} from '@lusilearn/shared-types';

// Mock the database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
} as unknown as Pool;

// Mock the safety moderation service
const mockSafetyModerationService = {
  moderateConversationMessage: jest.fn(),
  createSafetyReport: jest.fn(),
  validateMinorCollaboration: jest.fn(),
} as jest.Mocked<Partial<SafetyModerationService>>;

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('CollaborationService - Comprehensive Tests', () => {
  let collaborationService: CollaborationService;

  beforeEach(() => {
    collaborationService = new CollaborationService(mockPool, 'http://ai-service:8001');
    (collaborationService as any).safetyModerationService = mockSafetyModerationService;
    jest.clearAllMocks();
  });

  describe('matchPeers', () => {
    it('should find peer matches using AI service with comprehensive criteria', async () => {
      const userId = 'test-user-id';
      const criteria: MatchingCriteria = {
        subjects: ['mathematics', 'programming'],
        skillLevels: ['beginner', 'intermediate'],
        learningGoals: ['learn algorithms', 'improve problem solving'],
        collaborationType: 'study_buddy',
        ageRange: '18-25',
        timeZone: 'America/New_York',
        communicationStyle: 'mixed'
      };

      // Mock user profile query
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'college', ageRange: '18-25' },
            learning_preferences: { sessionDuration: 60 }
          }]
        })
        // Mock collaboration preferences query
        .mockResolvedValueOnce({
          rows: [{
            available_hours: {
              monday: ['09:00-17:00'],
              tuesday: ['09:00-17:00'],
              wednesday: ['14:00-18:00']
            }
          }]
        })
        // Mock communication preferences query
        .mockResolvedValueOnce({
          rows: [{
            communication_style: 'mixed'
          }]
        })
        // Mock store peer match queries (multiple calls)
        .mockResolvedValue({ rows: [] });

      // Mock successful AI service response
      const aiMatches = [
        {
          user_id: 'peer-1',
          compatibility_score: 85,
          shared_subjects: ['mathematics', 'programming'],
          complementary_skills: { 'mathematics': 'Advanced algebra skills' },
          common_goals: ['learn algorithms'],
          availability_overlap: ['monday: 14:00-16:00'],
          communication_match: ['chat', 'video_call'],
          match_reasons: ['High skill complementarity', 'Shared learning goals']
        },
        {
          user_id: 'peer-2',
          compatibility_score: 78,
          shared_subjects: ['programming'],
          complementary_skills: { 'programming': 'JavaScript expertise' },
          common_goals: ['improve problem solving'],
          availability_overlap: ['tuesday: 15:00-17:00'],
          communication_match: ['chat'],
          match_reasons: ['Good availability overlap', 'Similar learning pace']
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ matches: aiMatches })
      });

      // Act
      const matches = await collaborationService.matchPeers(userId, criteria);

      // Assert
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBe(2);
      
      expect(matches[0]).toEqual(expect.objectContaining({
        userId: 'peer-1',
        compatibilityScore: 85,
        sharedInterests: ['mathematics', 'programming'],
        complementarySkills: ['mathematics'],
        matchReason: expect.stringContaining('High skill complementarity')
      }));

      expect(global.fetch).toHaveBeenCalledWith(
        'http://ai-service:8001/api/v1/peer-matching/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(userId)
        })
      );
    });

    it('should handle AI service failure with fallback mock data', async () => {
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
        .mockResolvedValue({ rows: [] });

      // Mock AI service failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AI service unavailable'));

      // Act
      const matches = await collaborationService.matchPeers(userId, criteria);

      // Assert
      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].userId).toContain('mock_peer');
      expect(matches[0].compatibilityScore).toBeGreaterThan(0);
    });

    it('should handle empty AI service response gracefully', async () => {
      const userId = 'test-user-id';
      const criteria: MatchingCriteria = {
        subjects: ['rare-subject'],
        skillLevels: ['expert'],
        learningGoals: ['advanced research'],
        collaborationType: 'mentor'
      };

      // Mock user profile query
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'graduate', ageRange: '25-35' },
            learning_preferences: {}
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] });

      // Mock empty AI service response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ matches: [] })
      });

      // Act
      const matches = await collaborationService.matchPeers(userId, criteria);

      // Assert
      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0); // Should fall back to mock data
      expect(matches[0].userId).toContain('mock_peer');
    });
  });

  describe('createStudyGroup', () => {
    it('should create a new study group with comprehensive validation', async () => {
      const creatorId = 'creator-id';
      const groupData = {
        name: 'Advanced Mathematics Study Group',
        description: 'A group for learning advanced mathematical concepts including calculus and linear algebra',
        topic: 'Advanced Mathematics',
        subject: 'Mathematics',
        maxSize: 8,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.FRIENDS,
        ageRestrictions: [AgeRange.ADULT] as AgeRange[]
      };

      // Mock database insert
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: 'group-123',
          created_at: new Date('2025-01-01'),
          updated_at: new Date('2025-01-01')
        }]
      });

      // Act
      const result = await collaborationService.createStudyGroup(creatorId, groupData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('group-123');
      expect(result.name).toBe(groupData.name);
      expect(result.description).toBe(groupData.description);
      expect(result.topic).toBe(groupData.topic);
      expect(result.subject).toBe(groupData.subject);
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0]).toEqual(expect.objectContaining({
        userId: creatorId,
        role: 'admin',
        isActive: true,
        contributionScore: 0
      }));
      expect(result.settings.maxSize).toBe(8);
      expect(result.settings.moderationLevel).toBe(ModerationLevel.MODERATE);
      expect(result.settings.privacy).toBe(PrivacyLevel.FRIENDS);
    });

    it('should validate required fields and throw error for invalid data', async () => {
      const creatorId = 'creator-id';
      const invalidGroupData = {
        name: 'AB', // Too short (minimum 3 characters)
        description: 'Valid description',
        topic: 'Valid topic',
        subject: 'Valid subject',
        maxSize: 6,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      // Act & Assert
      await expect(
        collaborationService.createStudyGroup(creatorId, invalidGroupData)
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      const creatorId = 'creator-id';
      const groupData = {
        name: 'Test Group',
        description: 'Test Description',
        topic: 'Test Topic',
        subject: 'Test Subject',
        maxSize: 6,
        moderationLevel: ModerationLevel.MODERATE,
        privacy: PrivacyLevel.PUBLIC
      };

      // Mock database error
      (mockPool.query as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        collaborationService.createStudyGroup(creatorId, groupData)
      ).rejects.toThrow('Failed to create study group');
    });
  });

  describe('createStudyGroupWithSafetyChecks', () => {
    it('should apply safety restrictions for minor users', async () => {
      const minorCreatorId = 'minor-creator-id';
      const groupData = {
        name: 'Teen Study Group',
        description: 'A study group for teenagers',
        topic: 'Basic Math',
        subject: 'Mathematics',
        maxSize: 6,
        moderationLevel: ModerationLevel.MINIMAL, // Should be upgraded
        privacy: PrivacyLevel.PUBLIC // Should be changed
      };

      // Mock user profile query for minor
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { ageRange: AgeRange.TEEN },
            learning_preferences: {}
          }]
        })
        // Mock group creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'group-123',
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

      // Act
      const result = await collaborationService.createStudyGroupWithSafetyChecks(minorCreatorId, groupData);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings.moderationLevel).toBe(ModerationLevel.MODERATE); // Upgraded from MINIMAL
      expect(result.settings.privacy).toBe(PrivacyLevel.FRIENDS); // Changed from PUBLIC
    });

    it('should maintain settings for adult users', async () => {
      const adultCreatorId = 'adult-creator-id';
      const groupData = {
        name: 'Adult Study Group',
        description: 'A study group for adults',
        topic: 'Advanced Topics',
        subject: 'Computer Science',
        maxSize: 10,
        moderationLevel: ModerationLevel.MINIMAL,
        privacy: PrivacyLevel.PUBLIC
      };

      // Mock user profile query for adult
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { ageRange: AgeRange.ADULT },
            learning_preferences: {}
          }]
        })
        // Mock group creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'group-123',
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

      // Act
      const result = await collaborationService.createStudyGroupWithSafetyChecks(adultCreatorId, groupData);

      // Assert
      expect(result).toBeDefined();
      expect(result.settings.moderationLevel).toBe(ModerationLevel.MINIMAL); // Unchanged
      expect(result.settings.privacy).toBe(PrivacyLevel.PUBLIC); // Unchanged
    });
  });

  describe('addParticipantWithSafetyChecks', () => {
    it('should validate minor participation with safety checks', async () => {
      const groupId = 'group-123';
      const minorUserId = 'minor-user-id';
      const requesterId = 'admin-user-id';

      const mockGroup = createMockStudyGroup(groupId, requesterId);

      // Mock get study group
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [mockGroup]
        })
        // Mock user profile query for minor
        .mockResolvedValueOnce({
          rows: [{
            demographics: { ageRange: AgeRange.TEEN },
            learning_preferences: {}
          }]
        })
        // Mock update group
        .mockResolvedValueOnce({ rows: [] });

      // Mock safety validation
      mockSafetyModerationService.validateMinorCollaboration!.mockResolvedValue({
        isAllowed: true,
        reason: 'Safe collaboration environment',
        restrictions: []
      });

      // Act
      const result = await collaborationService.addParticipantWithSafetyChecks(groupId, minorUserId, requesterId);

      // Assert
      expect(result.participants).toHaveLength(2);
      expect(result.participants[1].userId).toBe(minorUserId);
      expect(mockSafetyModerationService.validateMinorCollaboration).toHaveBeenCalledWith(
        minorUserId,
        `group_${groupId}`,
        [requesterId]
      );
    });

    it('should reject minor participation when safety validation fails', async () => {
      const groupId = 'group-123';
      const minorUserId = 'minor-user-id';
      const requesterId = 'admin-user-id';

      const mockGroup = createMockStudyGroup(groupId, requesterId);

      // Mock get study group
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [mockGroup]
        })
        // Mock user profile query for minor
        .mockResolvedValueOnce({
          rows: [{
            demographics: { ageRange: AgeRange.TEEN },
            learning_preferences: {}
          }]
        });

      // Mock safety validation failure
      mockSafetyModerationService.validateMinorCollaboration!.mockResolvedValue({
        isAllowed: false,
        reason: 'Unsafe collaboration environment detected',
        restrictions: ['no_unsupervised_interaction']
      });

      // Act & Assert
      await expect(
        collaborationService.addParticipantWithSafetyChecks(groupId, minorUserId, requesterId)
      ).rejects.toThrow('Minor participation not allowed');
    });

    it('should enforce age restrictions', async () => {
      const groupId = 'group-123';
      const teenUserId = 'teen-user-id';
      const requesterId = 'admin-user-id';

      const mockGroup = {
        ...createMockStudyGroup(groupId, requesterId),
        settings: {
          ...createMockStudyGroup(groupId, requesterId).settings,
          ageRestrictions: [AgeRange.ADULT] // Only adults allowed
        }
      };

      // Mock get study group
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [mockGroup]
        })
        // Mock user profile query for teen
        .mockResolvedValueOnce({
          rows: [{
            demographics: { ageRange: AgeRange.TEEN },
            learning_preferences: {}
          }]
        });

      // Act & Assert
      await expect(
        collaborationService.addParticipantWithSafetyChecks(groupId, teenUserId, requesterId)
      ).rejects.toThrow('User age range teen not allowed in this group');
    });
  });

  describe('moderateConversationMessage', () => {
    it('should moderate conversation messages with safety checks', async () => {
      const sessionId = 'session-123';
      const userId = 'user-123';
      const message = 'Hello everyone, let\'s start studying!';

      const moderationResult = {
        isAppropriate: true,
        confidence: 0.95,
        flags: [],
        action: 'allow',
        severity: 'low'
      };

      mockSafetyModerationService.moderateConversationMessage!.mockResolvedValue(moderationResult);

      // Mock logging query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await collaborationService.moderateConversationMessage(sessionId, userId, message);

      // Assert
      expect(result).toEqual(moderationResult);
      expect(mockSafetyModerationService.moderateConversationMessage).toHaveBeenCalledWith(
        sessionId,
        userId,
        message,
        'text',
        undefined
      );
    });

    it('should handle inappropriate messages', async () => {
      const sessionId = 'session-123';
      const userId = 'user-123';
      const message = 'This is an inappropriate message with bad words';

      const moderationResult = {
        isAppropriate: false,
        confidence: 0.9,
        flags: ['inappropriate_language', 'harassment'],
        action: 'temporary_mute',
        severity: 'high'
      };

      mockSafetyModerationService.moderateConversationMessage!.mockResolvedValue(moderationResult);

      // Mock logging query
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await collaborationService.moderateConversationMessage(sessionId, userId, message);

      // Assert
      expect(result).toEqual(moderationResult);
      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('inappropriate_language');
      expect(result.action).toBe('temporary_mute');
    });
  });

  describe('createSafetyReport', () => {
    it('should create safety report for inappropriate behavior', async () => {
      const reporterId = 'reporter-123';
      const reportData = {
        reportedUserId: 'reported-user-123',
        sessionId: 'session-123',
        type: SafetyReportType.HARASSMENT,
        category: SafetyCategory.BULLYING,
        description: 'User was being inappropriate and bullying others',
        evidence: [{ type: 'message', content: 'Inappropriate message content' }]
      };

      const createdReport = {
        id: 'report-123',
        reporterId,
        ...reportData,
        status: 'pending',
        createdAt: new Date()
      };

      mockSafetyModerationService.createSafetyReport!.mockResolvedValue(createdReport);

      // Act
      const result = await collaborationService.createSafetyReport(reporterId, reportData);

      // Assert
      expect(result).toEqual(createdReport);
      expect(mockSafetyModerationService.createSafetyReport).toHaveBeenCalledWith(reporterId, reportData);
    });

    it('should notify group moderators for group-related reports', async () => {
      const reporterId = 'reporter-123';
      const reportData = {
        reportedUserId: 'reported-user-123',
        groupId: 'group-123',
        type: SafetyReportType.INAPPROPRIATE_CONTENT,
        category: SafetyCategory.SPAM,
        description: 'User is spamming the group chat',
        evidence: []
      };

      const createdReport = {
        id: 'report-123',
        reporterId,
        ...reportData,
        status: 'pending',
        createdAt: new Date()
      };

      mockSafetyModerationService.createSafetyReport!.mockResolvedValue(createdReport);

      // Act
      const result = await collaborationService.createSafetyReport(reporterId, reportData);

      // Assert
      expect(result).toEqual(createdReport);
      expect(mockSafetyModerationService.createSafetyReport).toHaveBeenCalledWith(reporterId, reportData);
    });
  });

  describe('createGroupActivity', () => {
    it('should create group activity with proper validation', async () => {
      const groupId = 'group-123';
      const creatorId = 'creator-123';
      const activityData = {
        type: CollaborationActivityType.STUDY_SESSION,
        title: 'Mathematics Study Session',
        description: 'Group study session for calculus problems',
        participants: ['creator-123', 'participant-1', 'participant-2'],
        startTime: new Date('2025-01-15T14:00:00Z'),
        endTime: new Date('2025-01-15T16:00:00Z')
      };

      const mockGroup = createMockStudyGroup(groupId, creatorId);

      // Mock get study group
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [mockGroup]
        })
        // Mock activity creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'activity-123',
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

      // Act
      const result = await collaborationService.createGroupActivity(groupId, creatorId, activityData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('activity-123');
      expect(result.type).toBe(activityData.type);
      expect(result.title).toBe(activityData.title);
      expect(result.description).toBe(activityData.description);
      expect(result.participants).toEqual(activityData.participants);
      expect(result.startTime).toEqual(activityData.startTime);
      expect(result.endTime).toEqual(activityData.endTime);
      expect(result.isCompleted).toBe(false);
    });

    it('should reject activity creation for non-members', async () => {
      const groupId = 'group-123';
      const nonMemberId = 'non-member-123';
      const activityData = {
        type: CollaborationActivityType.STUDY_SESSION,
        title: 'Unauthorized Activity',
        description: 'This should fail',
        participants: ['non-member-123'],
        startTime: new Date(),
        endTime: new Date()
      };

      const mockGroup = createMockStudyGroup(groupId, 'different-user');

      // Mock get study group
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockGroup]
      });

      // Act & Assert
      await expect(
        collaborationService.createGroupActivity(groupId, nonMemberId, activityData)
      ).rejects.toThrow('User is not a member of this group');
    });
  });

  // Helper function to create mock study group
  function createMockStudyGroup(groupId: string, creatorId: string) {
    return {
      id: groupId,
      name: 'Test Group',
      description: 'Test Description',
      topic: 'Test Topic',
      subject: 'Test Subject',
      participants: [{
        userId: creatorId,
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
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  }
});