import { ContentModerationService } from '../content-moderation.service';
import { 
  ContentItem, 
  ContentSource, 
  ContentFormat, 
  DifficultyLevel, 
  AgeRating 
} from '@lusilearn/shared-types';
import axios from 'axios';

// Mock axios for API calls
jest.mock('axios');
jest.mock('../../utils/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ContentModerationService', () => {
  let moderationService: ContentModerationService;

  const mockContentItem: ContentItem = {
    id: 'test-content-id',
    source: ContentSource.YOUTUBE,
    externalId: 'test-video-id',
    url: 'https://youtube.com/watch?v=test-video-id',
    title: 'Learn JavaScript Programming',
    description: 'A comprehensive tutorial on JavaScript programming for beginners',
    thumbnailUrl: 'https://img.youtube.com/vi/test-video-id/hqdefault.jpg',
    metadata: {
      duration: 1200,
      difficulty: DifficultyLevel.BEGINNER,
      subject: 'programming',
      topics: ['javascript', 'programming', 'tutorial'],
      format: ContentFormat.VIDEO,
      language: 'en',
      learningObjectives: ['Learn JavaScript basics', 'Understand variables and functions']
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

  beforeEach(() => {
    moderationService = new ContentModerationService();
    jest.clearAllMocks();
  });

  describe('moderateContent', () => {
    it('should approve appropriate educational content', async () => {
      // Set up environment variable for the test
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      // Use content that won't trigger keyword moderation
      const cleanEducationalContent = {
        ...mockContentItem,
        title: 'Learn JavaScript Programming Basics',
        description: 'A comprehensive tutorial on JavaScript programming for beginners. Learn variables, functions, and more.'
      };
      
      // Mock OpenAI moderation API response
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [{
            flagged: false,
            categories: {
              hate: false,
              harassment: false,
              violence: false,
              sexual: false,
              'self-harm': false
            }
          }]
        }
      });

      const result = await moderationService.moderateContent(cleanEducationalContent);

      expect(result.isAppropriate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.flags).toHaveLength(0);
      expect(result.suggestedAgeRating).toBe(AgeRating.ALL_AGES);
    });

    it('should flag inappropriate content', async () => {
      // Set up environment variable for the test
      process.env.OPENAI_API_KEY = 'test-api-key';
      
      const inappropriateContent = {
        ...mockContentItem,
        title: 'Explicit Adult Content',
        description: 'This contains inappropriate material'
      };

      // Mock OpenAI moderation API response for flagged content
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [{
            flagged: true,
            categories: {
              hate: false,
              harassment: false,
              violence: false,
              sexual: true,
              'self-harm': false
            }
          }]
        }
      });

      const result = await moderationService.moderateContent(inappropriateContent);

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('sexual_content');
      expect(result.reasons).toContain('Content contains sexual material');
      expect(result.suggestedAgeRating).toBe(AgeRating.ADULT);
    });

    it('should handle API failures gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await moderationService.moderateContent(mockContentItem);

      expect(result.isAppropriate).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.flags).toContain('moderation_error');
    });

    it('should detect inappropriate keywords', async () => {
      const keywordContent = {
        ...mockContentItem,
        title: 'Violent and Disturbing Content',
        description: 'This content contains explicit violence'
      };

      // Mock successful AI moderation but keyword detection should catch it
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [{
            flagged: false,
            categories: {
              hate: false,
              harassment: false,
              violence: false,
              sexual: false,
              'self-harm': false
            }
          }]
        }
      });

      const result = await moderationService.moderateContent(keywordContent);

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('inappropriate_keyword');
    });
  });

  describe('assessContentQuality', () => {
    it('should assess high-quality educational content', async () => {
      const result = await moderationService.assessContentQuality(mockContentItem);

      expect(result.overallScore).toBeGreaterThan(70);
      expect(result.factors.educationalValue).toBeGreaterThan(60);
      expect(result.factors.contentClarity).toBeGreaterThan(60);
      expect(result.factors.ageAppropriateness).toBeGreaterThan(70);
      expect(result.recommendations).toBeDefined();
    });

    it('should identify quality issues', async () => {
      const lowQualityContent = {
        ...mockContentItem,
        title: 'Bad',
        description: 'Short',
        metadata: {
          ...mockContentItem.metadata,
          duration: 30, // Too short
          subject: 'general', // Generic subject
          learningObjectives: [] // No objectives
        }
      };

      const result = await moderationService.assessContentQuality(lowQualityContent);

      expect(result.overallScore).toBeLessThan(50);
      expect(result.recommendations).toContain('Improve content title and description clarity');
      expect(result.recommendations).toContain('Add clear learning objectives and better subject classification');
    });

    it('should handle different content durations appropriately', async () => {
      const shortContent = {
        ...mockContentItem,
        metadata: { ...mockContentItem.metadata, duration: 60 } // 1 minute
      };

      const longContent = {
        ...mockContentItem,
        metadata: { ...mockContentItem.metadata, duration: 7200 } // 2 hours
      };

      const optimalContent = {
        ...mockContentItem,
        metadata: { ...mockContentItem.metadata, duration: 900 } // 15 minutes
      };

      const shortResult = await moderationService.assessContentQuality(shortContent);
      const longResult = await moderationService.assessContentQuality(longContent);
      const optimalResult = await moderationService.assessContentQuality(optimalContent);

      expect(optimalResult.factors.technicalQuality).toBeGreaterThan(shortResult.factors.technicalQuality);
      expect(optimalResult.factors.technicalQuality).toBeGreaterThan(longResult.factors.technicalQuality);
    });
  });

  describe('filterContentForUser', () => {
    const contentArray = [
      mockContentItem,
      {
        ...mockContentItem,
        id: 'adult-content',
        ageRating: AgeRating.ADULT,
        title: 'Advanced Professional Development'
      },
      {
        ...mockContentItem,
        id: 'reported-content',
        qualityMetrics: {
          ...mockContentItem.qualityMetrics,
          reportCount: 15 // High report count
        }
      },
      {
        ...mockContentItem,
        id: 'low-quality-content',
        qualityMetrics: {
          ...mockContentItem.qualityMetrics,
          effectivenessScore: 20 // Low effectiveness
        }
      }
    ];

    it('should filter content appropriately for child users', async () => {
      const result = await moderationService.filterContentForUser(
        contentArray,
        'child'
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-content-id');
      expect(result.every(item => item.ageRating === AgeRating.ALL_AGES)).toBe(true);
    });

    it('should allow more content for adult users', async () => {
      const result = await moderationService.filterContentForUser(
        contentArray,
        'adult'
      );

      expect(result.length).toBeGreaterThan(1);
      expect(result.some(item => item.ageRating === AgeRating.ADULT)).toBe(true);
    });

    it('should apply parental controls filtering', async () => {
      const parentalControls = {
        contentFiltering: 'strict'
      };

      const result = await moderationService.filterContentForUser(
        contentArray,
        'child',
        parentalControls
      );

      expect(result).toHaveLength(1);
      expect(result[0].qualityMetrics.reportCount).toBe(0);
    });

    it('should filter out low-quality content', async () => {
      const result = await moderationService.filterContentForUser(
        contentArray,
        'adult'
      );

      expect(result.every(item => item.qualityMetrics.effectivenessScore >= 30)).toBe(true);
    });

    it('should filter out heavily reported content', async () => {
      const result = await moderationService.filterContentForUser(
        contentArray,
        'adult'
      );

      expect(result.every(item => item.qualityMetrics.reportCount <= 10)).toBe(true);
    });
  });

  describe('age appropriateness assessment', () => {
    it('should suggest appropriate age ratings based on content', async () => {
      const childContent = {
        ...mockContentItem,
        title: 'Basic Elementary Math for Kids',
        description: 'Simple math concepts for children'
      };

      const teenContent = {
        ...mockContentItem,
        title: 'High School SAT Preparation',
        description: 'College prep materials for teenagers'
      };

      const adultContent = {
        ...mockContentItem,
        title: 'Advanced Professional Enterprise Development',
        description: 'Complex software architecture for professionals',
        metadata: {
          ...mockContentItem.metadata,
          difficulty: DifficultyLevel.EXPERT
        }
      };

      // Mock AI moderation to focus on age assessment
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [{
            flagged: false,
            categories: {
              hate: false,
              harassment: false,
              violence: false,
              sexual: false,
              'self-harm': false
            }
          }]
        }
      });

      const childResult = await moderationService.moderateContent(childContent);
      const teenResult = await moderationService.moderateContent(teenContent);
      const adultResult = await moderationService.moderateContent(adultContent);

      expect(childResult.suggestedAgeRating).toBe(AgeRating.ALL_AGES);
      expect(teenResult.suggestedAgeRating).toBe(AgeRating.TEEN);
      expect(adultResult.suggestedAgeRating).toBe(AgeRating.ADULT);
    });
  });

  describe('error handling', () => {
    it('should handle missing OpenAI API key', async () => {
      // Create service without API key
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      const serviceWithoutKey = new ContentModerationService();
      
      const result = await serviceWithoutKey.moderateContent(mockContentItem);
      
      expect(result.isAppropriate).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
      
      // Restore API key
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should handle network timeouts', async () => {
      mockedAxios.post.mockRejectedValue(new Error('timeout'));

      const result = await moderationService.moderateContent(mockContentItem);

      expect(result.isAppropriate).toBe(false);
      expect(result.flags).toContain('moderation_error');
      expect(result.reasons).toContain('Content moderation service encountered an error');
    });
  });
});