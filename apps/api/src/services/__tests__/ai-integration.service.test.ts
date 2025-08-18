import { ContentService } from '../content.service';
import { Pool } from 'pg';
import {
  ContentItem,
  ContentSource,
  DifficultyLevel,
  AgeRating,
  ContentFormat,
  ContentQuery,
  ValidationResult
} from '@lusilearn/shared-types';

// Mock the dependencies
jest.mock('../../utils/logger');

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('AI Integration Service Tests', () => {
  let contentService: ContentService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      query: jest.fn(),
    } as any;

    contentService = new ContentService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Service Integration', () => {
    describe('Content Recommendation Integration', () => {
      it('should get AI-powered content recommendations successfully', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'mathematics';
        const mockAIResponse = {
          recommendations: [
            {
              content_id: 'ai-rec-1',
              title: 'Algebra Basics',
              description: 'Introduction to algebraic concepts',
              relevance_score: 0.95,
              quality_score: 0.88,
              source: 'khan_academy',
              url: 'https://example.com/algebra-basics',
              difficulty: 'intermediate',
              format: 'video',
              duration_minutes: 30,
              topics: ['algebra', 'mathematics']
            },
            {
              content_id: 'ai-rec-2',
              title: 'Geometry Fundamentals',
              description: 'Basic geometric shapes and properties',
              relevance_score: 0.87,
              quality_score: 0.92,
              source: 'coursera',
              url: 'https://example.com/geometry-fundamentals',
              difficulty: 'intermediate',
              format: 'interactive',
              duration_minutes: 45,
              topics: ['geometry', 'mathematics']
            }
          ]
        };

        // Mock successful AI service response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations).toHaveLength(2);
        expect(recommendations[0]).toMatchObject({
          id: 'ai-rec-1',
          title: 'Algebra Basics',
          source: ContentSource.KHAN_ACADEMY,
          qualityScore: 0.88
        });
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/recommendations'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining(userId)
          })
        );
      });

      it('should handle AI service failure with fallback recommendations', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'mathematics';

        // Mock AI service failure
        (global.fetch as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

        // Mock database fallback
        mockPool.query.mockResolvedValue({
          rows: [
            {
              id: 'fallback-1',
              title: 'Basic Math',
              source: 'youtube',
              url: 'https://example.com/basic-math',
              metadata: JSON.stringify({
                difficulty: 'beginner',
                duration: 20,
                subject: 'mathematics'
              }),
              quality_score: 0.7,
              age_rating: 'general',
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].title).toBe('Basic Math');
        expect(recommendations[0].source).toBe(ContentSource.YOUTUBE);
      });

      it('should validate AI recommendation quality scores', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'science';
        const mockAIResponse = {
          recommendations: [
            {
              content_id: 'high-quality',
              title: 'Physics Fundamentals',
              description: 'High-quality physics content',
              relevance_score: 0.95,
              quality_score: 0.92, // High quality
              source: 'khan_academy',
              url: 'https://example.com/physics',
              difficulty: 'intermediate',
              format: 'video',
              duration_minutes: 40,
              topics: ['physics', 'science']
            },
            {
              content_id: 'low-quality',
              title: 'Random Science Video',
              description: 'Low-quality content',
              relevance_score: 0.60,
              quality_score: 0.35, // Low quality
              source: 'youtube',
              url: 'https://example.com/random-science',
              difficulty: 'beginner',
              format: 'video',
              duration_minutes: 15,
              topics: ['science']
            }
          ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic, { minQualityScore: 0.8 });

        // Assert
        expect(recommendations).toHaveLength(1); // Only high-quality content
        expect(recommendations[0].qualityScore).toBeGreaterThanOrEqual(0.8);
        expect(recommendations[0].title).toBe('Physics Fundamentals');
      });
    });

    describe('Learning Path Generation Integration', () => {
      it('should generate AI-powered learning path successfully', async () => {
        // Arrange
        const userId = 'user-123';
        const subject = 'programming';
        const goals = ['learn javascript', 'build web applications'];
        const mockAIResponse = {
          learning_path: {
            id: 'ai-path-123',
            subject: 'programming',
            difficulty_level: 'intermediate',
            objectives: [
              {
                id: 'obj-1',
                title: 'JavaScript Fundamentals',
                description: 'Learn basic JavaScript concepts',
                estimated_duration: 120,
                prerequisites: [],
                skills: ['variables', 'functions', 'loops']
              },
              {
                id: 'obj-2',
                title: 'DOM Manipulation',
                description: 'Learn to interact with web pages',
                estimated_duration: 90,
                prerequisites: ['obj-1'],
                skills: ['dom', 'events', 'javascript']
              }
            ],
            milestones: [
              {
                id: 'milestone-1',
                title: 'JavaScript Basics Complete',
                description: 'Master fundamental JavaScript concepts',
                objectives: ['obj-1'],
                completion_criteria: ['Complete all exercises', 'Pass assessment']
              }
            ]
          }
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const learningPath = await contentService.generateAILearningPath(userId, subject, goals);

        // Assert
        expect(learningPath).toBeDefined();
        expect(learningPath.subject).toBe('programming');
        expect(learningPath.objectives).toHaveLength(2);
        expect(learningPath.milestones).toHaveLength(1);
        expect(learningPath.objectives[0].title).toBe('JavaScript Fundamentals');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/learning-paths/generate'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(subject)
          })
        );
      });

      it('should handle AI service timeout with fallback', async () => {
        // Arrange
        const userId = 'user-123';
        const subject = 'mathematics';
        const goals = ['learn algebra'];

        // Mock AI service timeout
        (global.fetch as jest.Mock).mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        );

        // Act
        const learningPath = await contentService.generateAILearningPath(userId, subject, goals);

        // Assert
        expect(learningPath).toBeDefined();
        expect(learningPath.subject).toBe(subject);
        expect(learningPath.objectives.length).toBeGreaterThan(0);
        // Should use fallback generation logic
        expect(learningPath.objectives[0].title).toContain('Number Systems'); // Fallback content
      });
    });

    describe('Peer Matching Integration', () => {
      it('should get AI-powered peer matches successfully', async () => {
        // Arrange
        const userId = 'user-123';
        const criteria = {
          subjects: ['mathematics', 'programming'],
          skillLevels: ['intermediate'],
          learningGoals: ['learn algorithms'],
          collaborationType: 'study_buddy'
        };
        const mockAIResponse = {
          matches: [
            {
              user_id: 'peer-1',
              compatibility_score: 0.92,
              shared_interests: ['mathematics', 'algorithms'],
              complementary_skills: ['programming', 'problem-solving'],
              communication_style_match: 0.85,
              timezone_compatibility: 0.95,
              safety_score: 0.98
            },
            {
              user_id: 'peer-2',
              compatibility_score: 0.87,
              shared_interests: ['programming'],
              complementary_skills: ['web development', 'databases'],
              communication_style_match: 0.78,
              timezone_compatibility: 0.90,
              safety_score: 0.96
            }
          ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const matches = await contentService.getAIPeerMatches(userId, criteria);

        // Assert
        expect(matches).toHaveLength(2);
        expect(matches[0]).toMatchObject({
          userId: 'peer-1',
          compatibilityScore: 0.92,
          sharedInterests: ['mathematics', 'algorithms']
        });
        expect(matches[0].compatibilityScore).toBeGreaterThan(0.8);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/peer-matching'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(userId)
          })
        );
      });

      it('should filter matches by safety score', async () => {
        // Arrange
        const userId = 'user-123';
        const criteria = { subjects: ['mathematics'] };
        const mockAIResponse = {
          matches: [
            {
              user_id: 'safe-peer',
              compatibility_score: 0.85,
              shared_interests: ['mathematics'],
              complementary_skills: [],
              communication_style_match: 0.80,
              timezone_compatibility: 0.90,
              safety_score: 0.95 // High safety score
            },
            {
              user_id: 'unsafe-peer',
              compatibility_score: 0.90,
              shared_interests: ['mathematics'],
              complementary_skills: [],
              communication_style_match: 0.85,
              timezone_compatibility: 0.85,
              safety_score: 0.65 // Low safety score
            }
          ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const matches = await contentService.getAIPeerMatches(userId, criteria, { minSafetyScore: 0.8 });

        // Assert
        expect(matches).toHaveLength(1); // Only safe peer
        expect(matches[0].userId).toBe('safe-peer');
        expect(matches[0].safetyScore).toBeGreaterThanOrEqual(0.8);
      });
    });

    describe('Content Analysis Integration', () => {
      it('should analyze content with AI for quality and appropriateness', async () => {
        // Arrange
        const contentUrl = 'https://example.com/educational-video';
        const mockAIResponse = {
          analysis: {
            quality_score: 0.88,
            educational_value: 0.92,
            age_appropriateness: {
              k12: true,
              college: true,
              professional: true
            },
            content_safety: {
              inappropriate_content: false,
              violence_score: 0.05,
              profanity_score: 0.02,
              adult_content_score: 0.01
            },
            difficulty_assessment: 'intermediate',
            topics_detected: ['mathematics', 'algebra', 'equations'],
            language_detected: 'english',
            transcript_quality: 0.85
          }
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const analysis = await contentService.analyzeContentWithAI(contentUrl);

        // Assert
        expect(analysis).toBeDefined();
        expect(analysis.qualityScore).toBe(0.88);
        expect(analysis.educationalValue).toBe(0.92);
        expect(analysis.ageAppropriateness.k12).toBe(true);
        expect(analysis.contentSafety.inappropriateContent).toBe(false);
        expect(analysis.topicsDetected).toContain('mathematics');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/content/analyze'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining(contentUrl)
          })
        );
      });

      it('should flag inappropriate content', async () => {
        // Arrange
        const contentUrl = 'https://example.com/inappropriate-video';
        const mockAIResponse = {
          analysis: {
            quality_score: 0.45,
            educational_value: 0.30,
            age_appropriateness: {
              k12: false,
              college: true,
              professional: true
            },
            content_safety: {
              inappropriate_content: true,
              violence_score: 0.75,
              profanity_score: 0.60,
              adult_content_score: 0.80
            },
            difficulty_assessment: 'intermediate',
            topics_detected: ['general'],
            language_detected: 'english',
            transcript_quality: 0.70
          }
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockAIResponse)
        });

        // Act
        const analysis = await contentService.analyzeContentWithAI(contentUrl);

        // Assert
        expect(analysis.contentSafety.inappropriateContent).toBe(true);
        expect(analysis.ageAppropriateness.k12).toBe(false);
        expect(analysis.qualityScore).toBeLessThan(0.5);
        expect(analysis.contentSafety.violenceScore).toBeGreaterThan(0.5);
      });
    });

    describe('AI Service Error Handling', () => {
      it('should handle AI service network errors gracefully', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'mathematics';

        // Mock network error
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        // Mock fallback database query
        mockPool.query.mockResolvedValue({
          rows: [
            {
              id: 'fallback-content',
              title: 'Fallback Math Content',
              source: 'khan_academy',
              url: 'https://example.com/fallback',
              metadata: JSON.stringify({ difficulty: 'beginner' }),
              quality_score: 0.8,
              age_rating: 'general',
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].title).toBe('Fallback Math Content');
        // Should log the error but not throw
      });

      it('should handle AI service returning invalid data', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'science';

        // Mock invalid AI response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            // Missing required fields
            invalid_data: true
          })
        });

        // Mock fallback
        mockPool.query.mockResolvedValue({ rows: [] });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations).toEqual([]);
        // Should handle gracefully without throwing
      });

      it('should handle AI service rate limiting', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'programming';

        // Mock rate limit response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: () => Promise.resolve({ error: 'Rate limit exceeded' })
        });

        // Mock fallback
        mockPool.query.mockResolvedValue({ rows: [] });

        // Act
        const recommendations = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations).toEqual([]);
        // Should handle rate limiting gracefully
      });
    });

    describe('AI Service Performance', () => {
      it('should timeout AI requests after reasonable time', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'mathematics';

        // Mock slow AI service
        (global.fetch as jest.Mock).mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
        );

        // Mock fallback
        mockPool.query.mockResolvedValue({ rows: [] });

        // Act
        const startTime = Date.now();
        const recommendations = await contentService.getAIRecommendations(userId, topic);
        const endTime = Date.now();

        // Assert
        expect(endTime - startTime).toBeLessThan(6000); // Should timeout before 6 seconds
        expect(recommendations).toEqual([]); // Should return fallback
      });

      it('should cache AI responses for performance', async () => {
        // Arrange
        const userId = 'user-123';
        const topic = 'mathematics';
        const mockResponse = {
          recommendations: [
            {
              content_id: 'cached-content',
              title: 'Cached Math Content',
              description: 'Cached content',
              relevance_score: 0.85,
              quality_score: 0.80,
              source: 'khan_academy',
              url: 'https://example.com/cached',
              difficulty: 'intermediate',
              format: 'video',
              duration_minutes: 30,
              topics: ['mathematics']
            }
          ]
        };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        });

        // Act - Make two identical requests
        const recommendations1 = await contentService.getAIRecommendations(userId, topic);
        const recommendations2 = await contentService.getAIRecommendations(userId, topic);

        // Assert
        expect(recommendations1).toEqual(recommendations2);
        // Should only call AI service once due to caching
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  // Helper methods for ContentService (these would be added to the actual service)
  describe('Helper Methods', () => {
    it('should convert AI response to internal format', () => {
      // This tests the conversion logic that would be in the actual service
      const aiRecommendation = {
        content_id: 'ai-123',
        title: 'Test Content',
        description: 'Test description',
        relevance_score: 0.95,
        quality_score: 0.88,
        source: 'khan_academy',
        url: 'https://example.com/test',
        difficulty: 'intermediate',
        format: 'video',
        duration_minutes: 30,
        topics: ['mathematics', 'algebra']
      };

      const converted = contentService.convertAIRecommendation(aiRecommendation);

      expect(converted).toMatchObject({
        id: 'ai-123',
        title: 'Test Content',
        source: ContentSource.KHAN_ACADEMY,
        qualityScore: 0.88,
        metadata: expect.objectContaining({
          difficulty: DifficultyLevel.INTERMEDIATE,
          duration: 30,
          subject: 'mathematics'
        })
      });
    });

    it('should validate AI response structure', () => {
      const validResponse = {
        recommendations: [
          {
            content_id: 'test',
            title: 'Test',
            relevance_score: 0.8,
            quality_score: 0.7,
            source: 'khan_academy'
          }
        ]
      };

      const invalidResponse = {
        // Missing recommendations array
        data: []
      };

      expect(contentService.validateAIResponse(validResponse)).toBe(true);
      expect(contentService.validateAIResponse(invalidResponse)).toBe(false);
    });
  });
});

// Extend ContentService with AI integration methods for testing
declare module '../content.service' {
  interface ContentService {
    getAIRecommendations(userId: string, topic: string, options?: any): Promise<ContentItem[]>;
    generateAILearningPath(userId: string, subject: string, goals: string[]): Promise<any>;
    getAIPeerMatches(userId: string, criteria: any, options?: any): Promise<any[]>;
    analyzeContentWithAI(contentUrl: string): Promise<any>;
    convertAIRecommendation(aiRec: any): ContentItem;
    validateAIResponse(response: any): boolean;
  }
}