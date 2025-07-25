import { describe, it, expect } from '@jest/globals';
import {
  UserProfileSchema,
  CreateUserRequestSchema,
  LearningPathSchema,
  ContentItemSchema,
  StudyGroupSchema,
  EducationLevel,
  DifficultyLevel,
  ContentSource,
  AgeRating,
  ContentFormat,
  LearningStyle,
  ContentType,
  AgeRange,
  ModerationLevel,
  PrivacyLevel,
  CollaborationActivityType
} from '../index';

describe('Shared Types Validation', () => {
  describe('User Types', () => {
    it('should validate a complete user profile', () => {
      const validUserProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        username: 'testuser',
        demographics: {
          ageRange: AgeRange.YOUNG_ADULT,
          educationLevel: EducationLevel.COLLEGE,
          timezone: 'America/New_York',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: [LearningStyle.VISUAL, LearningStyle.KINESTHETIC],
          preferredContentTypes: [ContentType.VIDEO, ContentType.INTERACTIVE],
          sessionDuration: 45,
          difficultyPreference: 'moderate' as const
        },
        skillProfile: [
          {
            subject: 'javascript',
            level: 7,
            confidence: 8,
            lastAssessed: new Date()
          }
        ],
        privacySettings: {
          profileVisibility: 'public' as const,
          allowPeerMatching: true,
          shareProgressData: true,
          allowDataCollection: false
        },
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = UserProfileSchema.safeParse(validUserProfile);
      expect(result.success).toBe(true);
    });

    it('should validate create user request', () => {
      const createUserRequest = {
        email: 'newuser@example.com',
        username: 'newuser',
        demographics: {
          ageRange: AgeRange.TEEN,
          educationLevel: EducationLevel.K12,
          timezone: 'America/Los_Angeles',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: [LearningStyle.AUDITORY],
          preferredContentTypes: [ContentType.VIDEO],
          sessionDuration: 30,
          difficultyPreference: 'gradual' as const
        }
      };

      const result = CreateUserRequestSchema.safeParse(createUserRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('Learning Types', () => {
    it('should validate a learning path', () => {
      const validLearningPath = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        subject: 'mathematics',
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            title: 'Learn Algebra Basics',
            description: 'Master fundamental algebraic concepts',
            estimatedDuration: 120,
            prerequisites: [],
            skills: ['algebra', 'equations']
          }
        ],
        milestones: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            title: 'Complete Algebra Module',
            description: 'Successfully complete all algebra objectives',
            objectives: ['123e4567-e89b-12d3-a456-426614174002'],
            completionCriteria: ['Pass final assessment'],
            isCompleted: false
          }
        ],
        progress: {
          completedObjectives: [],
          currentMilestone: '123e4567-e89b-12d3-a456-426614174003',
          overallProgress: 25,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = LearningPathSchema.safeParse(validLearningPath);
      expect(result.success).toBe(true);
    });
  });

  describe('Content Types', () => {
    it('should validate a content item', () => {
      const validContentItem = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        source: ContentSource.YOUTUBE,
        externalId: 'abc123',
        url: 'https://youtube.com/watch?v=abc123',
        title: 'Introduction to JavaScript',
        description: 'Learn the basics of JavaScript programming',
        thumbnailUrl: 'https://img.youtube.com/vi/abc123/maxresdefault.jpg',
        metadata: {
          duration: 1800,
          difficulty: DifficultyLevel.BEGINNER,
          subject: 'programming',
          topics: ['javascript', 'variables', 'functions'],
          format: ContentFormat.VIDEO,
          language: 'en',
          learningObjectives: ['Understand variables', 'Write functions']
        },
        qualityMetrics: {
          userRating: 4.5,
          completionRate: 85,
          effectivenessScore: 90,
          reportCount: 0,
          lastUpdated: new Date()
        },
        ageRating: AgeRating.ALL_AGES,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = ContentItemSchema.safeParse(validContentItem);
      expect(result.success).toBe(true);
    });
  });

  describe('Collaboration Types', () => {
    it('should validate a study group', () => {
      const validStudyGroup = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'JavaScript Study Group',
        description: 'Learn JavaScript together',
        topic: 'Web Development',
        subject: 'programming',
        participants: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174001',
            role: 'admin' as const,
            joinedAt: new Date(),
            isActive: true,
            contributionScore: 95
          }
        ],
        settings: {
          maxSize: 6,
          ageRestrictions: [AgeRange.YOUNG_ADULT, AgeRange.ADULT],
          moderationLevel: ModerationLevel.MODERATE,
          privacy: PrivacyLevel.PUBLIC,
          requiresApproval: false
        },
        activities: [
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            type: CollaborationActivityType.STUDY_SESSION,
            title: 'Weekly JavaScript Review',
            description: 'Review concepts from the week',
            participants: ['123e4567-e89b-12d3-a456-426614174001'],
            startTime: new Date(),
            isCompleted: false
          }
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = StudyGroupSchema.safeParse(validStudyGroup);
      expect(result.success).toBe(true);
    });
  });

  describe('Enum Values', () => {
    it('should have correct enum values', () => {
      expect(EducationLevel.K12).toBe('k12');
      expect(EducationLevel.COLLEGE).toBe('college');
      expect(EducationLevel.PROFESSIONAL).toBe('professional');

      expect(DifficultyLevel.BEGINNER).toBe('beginner');
      expect(DifficultyLevel.INTERMEDIATE).toBe('intermediate');
      expect(DifficultyLevel.ADVANCED).toBe('advanced');
      expect(DifficultyLevel.EXPERT).toBe('expert');

      expect(ContentSource.YOUTUBE).toBe('youtube');
      expect(ContentSource.KHAN_ACADEMY).toBe('khan_academy');
      expect(ContentSource.COURSERA).toBe('coursera');
      expect(ContentSource.GITHUB).toBe('github');
      expect(ContentSource.INTERNAL).toBe('internal');

      expect(AgeRating.ALL_AGES).toBe('all_ages');
      expect(AgeRating.TEEN).toBe('teen');
      expect(AgeRating.ADULT).toBe('adult');
    });
  });
});