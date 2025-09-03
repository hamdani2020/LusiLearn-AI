import { ContentService } from '../content.service';
import { LearningPathService } from '../learning-path.service';
import { CollaborationService } from '../collaboration.service';
import { Pool } from 'pg';
import {
  ContentSource,
  ContentFormat,
  DifficultyLevel,
  AgeRating,
  LearningGoal,
  MatchingCriteria,
  UserProfile,
  EducationLevel,
  AgeRange
} from '@lusilearn/shared-types';

// Mock all dependencies
jest.mock('../../repositories/content.repository');
jest.mock('../../repositories/content-report.repository');
jest.mock('../external/youtube.service');
jest.mock('../external/khan-academy.service');
jest.mock('../content-moderation.service');
jest.mock('../elasticsearch.service');
jest.mock('../user.service');
jest.mock('../adaptive-difficulty.service');
jest.mock('../../repositories/learning-path.repository');
jest.mock('../../utils/logger');

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('AI Service Integration Tests', () => {
  let contentService: ContentService;
  let learningPathService: LearningPathService;
  let collaborationService: CollaborationService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
    } as any;

    // Create service instances
    contentService = new ContentService({} as any, {} as any);
    learningPathService = new LearningPathService(mockPool);
    collaborationService = new CollaborationService(mockPool, 'http://ai-service:8001');

    // Mock elasticsearch service to avoid File global issues
    (contentService as any).elasticsearchService = {
      searchContent: jest.fn(),
      getSuggestions: jest.fn(),
      getRelatedContent: jest.fn(),
      indexContent: jest.fn(),
      bulkIndexContent: jest.fn(),
      updateContent: jest.fn(),
      deleteContent: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe('Content Recommendations AI Integration', () => {
    it('should get AI-powered content recommendations successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const options = { subject: 'programming', limit: 10 };

      const aiResponse = {
        recommendations: [
          {
            content_id: 'content-1',
            title: 'JavaScript Fundamentals',
            description: 'Learn the basics of JavaScript programming',
            url: 'https://example.com/js-fundamentals',
            score: 0.95,
            reason: 'Matches your beginner level and learning style',
            estimated_duration: 120,
            difficulty: 'beginner',
            format: 'video'
          },
          {
            content_id: 'content-2',
            title: 'Python for Beginners',
            description: 'Introduction to Python programming',
            url: 'https://example.com/python-intro',
            score: 0.88,
            reason: 'Good progression from JavaScript basics',
            estimated_duration: 90,
            difficulty: 'beginner',
            format: 'interactive'
          }
        ]
      };

      const mockContentItem = {
        id: 'content-1',
        source: ContentSource.YOUTUBE,
        externalId: 'js-fundamentals',
        url: 'https://example.com/js-fundamentals',
        title: 'JavaScript Fundamentals',
        description: 'Learn the basics of JavaScript programming',
        metadata: {
          duration: 120,
          difficulty: DifficultyLevel.BEGINNER,
          subject: 'programming',
          topics: ['javascript', 'fundamentals'],
          format: ContentFormat.VIDEO,
          language: 'en',
          learningObjectives: ['Understand JavaScript syntax', 'Write basic programs']
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

      // Mock AI service response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse)
      });

      // Mock content repository
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.findById = jest.fn().mockResolvedValue(mockContentItem);

      // Act
      const result = await contentService.getRecommendations(userId, options);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recommendations/'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(userId)
        })
      );

      // Verify the request body contains expected fields
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody).toEqual(expect.objectContaining({
        user_id: userId,
        current_topic: options.subject,
        education_level: expect.any(String),
        skill_level: expect.any(String),
        learning_context: expect.any(String),
        preferred_formats: expect.any(Array),
        max_duration: expect.any(Number),
        exclude_content: expect.any(Array)
      }));
    });

    it('should handle AI service timeout gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const options = { subject: 'mathematics', limit: 5 };

      // Mock AI service timeout
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      // Mock fallback content search
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.search = jest.fn().mockResolvedValue({
        items: [],
        total: 0
      });

      // Act
      const result = await contentService.getRecommendations(userId, options);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should return empty array when both AI and fallback fail
      expect(result.length).toBe(0);
    });

    it('should handle malformed AI service response', async () => {
      // Arrange
      const userId = 'user-123';
      const options = { subject: 'science', limit: 3 };

      // Mock malformed AI service response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      // Mock fallback content search
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.search = jest.fn().mockResolvedValue({
        items: [],
        total: 0
      });

      // Act
      const result = await contentService.getRecommendations(userId, options);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Learning Path Generation AI Integration', () => {
    it('should generate AI-enhanced learning paths', async () => {
      // Arrange
      const userId = 'user-123';
      const subject = 'javascript';
      const goals: LearningGoal[] = [
        {
          id: 'goal-1',
          title: 'Master JavaScript Fundamentals',
          description: 'Learn core JavaScript concepts',
          targetDate: new Date('2025-03-01'),
          priority: 'high',
          isCompleted: false
        }
      ];

      const mockUserProfile: UserProfile = {
        id: userId,
        email: 'user@example.com',
        username: 'testuser',
        demographics: {
          ageRange: AgeRange.ADULT,
          educationLevel: EducationLevel.COLLEGE,
          timezone: 'America/New_York',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: ['visual', 'kinesthetic'],
          preferredContentTypes: ['video', 'interactive'],
          sessionDuration: 60,
          difficultyPreference: 'adaptive'
        },
        skillProfile: [],
        privacySettings: {
          profileVisibility: 'friends',
          allowPeerMatching: true,
          shareProgressData: false,
          allowDataCollection: false
        },
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const aiResponse = {
        path_id: 'ai-path-123',
        objectives: [
          {
            id: 'obj-1',
            title: 'JavaScript Syntax and Variables',
            description: 'Learn basic JavaScript syntax, variables, and data types',
            estimated_hours: 3,
            prerequisites: [],
            skills_gained: ['variables', 'data-types', 'syntax']
          },
          {
            id: 'obj-2',
            title: 'Functions and Control Flow',
            description: 'Master functions, conditionals, and loops',
            estimated_hours: 4,
            prerequisites: ['obj-1'],
            skills_gained: ['functions', 'conditionals', 'loops']
          }
        ],
        difficulty_progression: 'beginner'
      };

      const mockLearningPath = {
        id: 'path-123',
        userId,
        subject,
        currentLevel: DifficultyLevel.BEGINNER,
        objectives: aiResponse.objectives.map(obj => ({
          id: obj.id,
          title: obj.title,
          description: obj.description,
          estimatedDuration: obj.estimated_hours * 60,
          prerequisites: obj.prerequisites,
          skills: obj.skills_gained
        })),
        milestones: [],
        progress: {
          completedObjectives: [],
          currentMilestone: 'milestone-1',
          overallProgress: 0,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock dependencies
      const mockUserService = (learningPathService as any).userService;
      const mockLearningPathRepository = (learningPathService as any).learningPathRepository;

      mockUserService.getProfile = jest.fn().mockResolvedValue(mockUserProfile);
      mockLearningPathRepository.findByUserIdAndSubject = jest.fn().mockResolvedValue(null);
      mockLearningPathRepository.create = jest.fn().mockResolvedValue(mockLearningPath);

      // Mock AI service response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse)
      });

      // Act
      const result = await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(result).toEqual(mockLearningPath);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/learning-paths/'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(subject)
        })
      );

      // Verify AI request body
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody).toEqual(expect.objectContaining({
        user_id: userId,
        subject: subject,
        education_level: expect.any(String),
        current_level: expect.any(String),
        learning_goals: expect.any(Array),
        time_commitment: expect.any(Number),
        learning_style: expect.any(String),
        prerequisites: expect.any(Array)
      }));
    });

    it('should fallback to local generation when AI service fails', async () => {
      // Arrange
      const userId = 'user-123';
      const subject = 'mathematics';
      const goals: LearningGoal[] = [];

      const mockUserProfile: UserProfile = {
        id: userId,
        email: 'user@example.com',
        username: 'testuser',
        demographics: {
          ageRange: AgeRange.ADULT,
          educationLevel: EducationLevel.COLLEGE,
          timezone: 'UTC',
          preferredLanguage: 'en'
        },
        learningPreferences: {
          learningStyle: ['visual'],
          preferredContentTypes: ['video'],
          sessionDuration: 45,
          difficultyPreference: 'adaptive'
        },
        skillProfile: [],
        privacySettings: {
          profileVisibility: 'friends',
          allowPeerMatching: true,
          shareProgressData: false,
          allowDataCollection: false
        },
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockLearningPath = {
        id: 'path-123',
        userId,
        subject,
        currentLevel: DifficultyLevel.INTERMEDIATE,
        objectives: [
          {
            id: 'math-1',
            title: 'Number Systems and Operations',
            description: 'Master basic arithmetic operations and number properties',
            estimatedDuration: 120,
            prerequisites: [],
            skills: ['addition', 'subtraction', 'multiplication', 'division']
          }
        ],
        milestones: [],
        progress: {
          completedObjectives: [],
          currentMilestone: 'milestone-1',
          overallProgress: 0,
          estimatedCompletion: new Date()
        },
        adaptationHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock dependencies
      const mockUserService = (learningPathService as any).userService;
      const mockLearningPathRepository = (learningPathService as any).learningPathRepository;

      mockUserService.getProfile = jest.fn().mockResolvedValue(mockUserProfile);
      mockLearningPathRepository.findByUserIdAndSubject = jest.fn().mockResolvedValue(null);
      mockLearningPathRepository.create = jest.fn().mockResolvedValue(mockLearningPath);

      // Mock AI service failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await learningPathService.generatePath(userId, subject, goals);

      // Assert
      expect(result).toEqual(mockLearningPath);
      expect(mockLearningPathRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          subject,
          currentLevel: DifficultyLevel.INTERMEDIATE,
          objectives: expect.arrayContaining([
            expect.objectContaining({
              title: 'Number Systems and Operations'
            })
          ])
        })
      );
    });
  });

  describe('Peer Matching AI Integration', () => {
    it('should find peer matches using AI service', async () => {
      // Arrange
      const userId = 'user-123';
      const criteria: MatchingCriteria = {
        subjects: ['programming', 'mathematics'],
        skillLevels: ['intermediate', 'advanced'],
        learningGoals: ['improve algorithms', 'learn data structures'],
        collaborationType: 'study_partner',
        ageRange: '22-30',
        timeZone: 'America/New_York'
      };

      const aiMatches = [
        {
          user_id: 'peer-1',
          compatibility_score: 92,
          shared_subjects: ['programming', 'mathematics'],
          complementary_skills: {
            'programming': 'Strong in algorithms and data structures',
            'mathematics': 'Advanced calculus and linear algebra'
          },
          common_goals: ['improve algorithms', 'learn data structures'],
          availability_overlap: ['monday: 18:00-20:00', 'wednesday: 19:00-21:00'],
          communication_match: ['video_call', 'chat', 'screen_sharing'],
          match_reasons: [
            'Excellent skill complementarity in target subjects',
            'Overlapping learning goals and study schedule',
            'Compatible communication preferences'
          ]
        },
        {
          user_id: 'peer-2',
          compatibility_score: 87,
          shared_subjects: ['programming'],
          complementary_skills: {
            'programming': 'Expert in web development and frameworks'
          },
          common_goals: ['improve algorithms'],
          availability_overlap: ['tuesday: 17:00-19:00', 'friday: 16:00-18:00'],
          communication_match: ['chat', 'voice_call'],
          match_reasons: [
            'Strong programming expertise',
            'Good availability match',
            'Similar learning pace and style'
          ]
        }
      ];

      // Mock database queries
      (mockPool.query as jest.Mock)
        // User profile query
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'college', ageRange: '22-30' },
            learning_preferences: { sessionDuration: 90 }
          }]
        })
        // Availability query
        .mockResolvedValueOnce({
          rows: [{
            available_hours: {
              monday: ['18:00-22:00'],
              tuesday: ['17:00-21:00'],
              wednesday: ['19:00-23:00'],
              friday: ['16:00-20:00']
            }
          }]
        })
        // Communication preferences query
        .mockResolvedValueOnce({
          rows: [{
            communication_style: 'mixed'
          }]
        })
        // Store peer match queries (multiple calls for each match)
        .mockResolvedValue({ rows: [] });

      // Mock AI service response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ matches: aiMatches })
      });

      // Act
      const result = await collaborationService.matchPeers(userId, criteria);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      expect(result[0]).toEqual(expect.objectContaining({
        userId: 'peer-1',
        compatibilityScore: 92,
        sharedInterests: ['programming', 'mathematics'],
        complementarySkills: ['programming', 'mathematics'],
        matchReason: expect.stringContaining('Excellent skill complementarity')
      }));

      expect(result[1]).toEqual(expect.objectContaining({
        userId: 'peer-2',
        compatibilityScore: 87,
        sharedInterests: ['programming'],
        complementarySkills: ['programming'],
        matchReason: expect.stringContaining('Strong programming expertise')
      }));

      expect(global.fetch).toHaveBeenCalledWith(
        'http://ai-service:8001/api/v1/peer-matching/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(userId)
        })
      );

      // Verify AI request body structure
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody).toEqual(expect.objectContaining({
        user_id: userId,
        subjects: criteria.subjects,
        skill_levels: expect.any(Object),
        learning_goals: criteria.learningGoals,
        availability: expect.any(Object),
        communication_preferences: expect.any(Array),
        age_range: criteria.ageRange,
        education_level: expect.any(String)
      }));
    });

    it('should handle AI service errors with graceful fallback', async () => {
      // Arrange
      const userId = 'user-123';
      const criteria: MatchingCriteria = {
        subjects: ['physics'],
        skillLevels: ['beginner'],
        learningGoals: ['understand basics'],
        collaborationType: 'tutor'
      };

      // Mock database queries
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            demographics: { educationLevel: 'high_school', ageRange: '16-18' },
            learning_preferences: {}
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] });

      // Mock AI service error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error')
      });

      // Act
      const result = await collaborationService.matchPeers(userId, criteria);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should return fallback mock data
      expect(result[0].userId).toContain('mock_peer');
      expect(result[0].compatibilityScore).toBeGreaterThan(0);
    });
  });

  describe('AI Service Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // Arrange
      const userId = 'user-123';

      // Mock network timeout
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      // Mock fallback data
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.search = jest.fn().mockResolvedValue({
        items: [],
        total: 0
      });

      // Act
      const result = await contentService.getRecommendations(userId, { subject: 'test' });

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle invalid JSON responses', async () => {
      // Arrange
      const userId = 'user-123';

      // Mock invalid JSON response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      // Mock fallback data
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.search = jest.fn().mockResolvedValue({
        items: [],
        total: 0
      });

      // Act
      const result = await contentService.getRecommendations(userId, { subject: 'test' });

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle HTTP error status codes', async () => {
      // Arrange
      const userId = 'user-123';

      // Mock HTTP error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      // Mock fallback data
      const mockContentRepository = (contentService as any).contentRepository;
      mockContentRepository.search = jest.fn().mockResolvedValue({
        items: [],
        total: 0
      });

      // Act
      const result = await contentService.getRecommendations(userId, { subject: 'test' });

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});