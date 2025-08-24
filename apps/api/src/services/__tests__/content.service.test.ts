import { ContentService } from '../content.service';
import { ContentRepository, CreateContentRequest } from '../../repositories/content.repository';
import { ContentReportRepository, CreateReportRequest } from '../../repositories/content-report.repository';
import { YouTubeService } from '../external/youtube.service';
import { KhanAcademyService } from '../external/khan-academy.service';
import { ContentModerationService } from '../content-moderation.service';
import { 
  ContentSource, 
  ContentFormat, 
  DifficultyLevel, 
  AgeRating,
  ContentQuery,
  ContentItem,
  ValidationResult
} from '@lusilearn/shared-types';

// Mock the dependencies
jest.mock('../../repositories/content.repository');
jest.mock('../../repositories/content-report.repository');
jest.mock('../external/youtube.service');
jest.mock('../external/khan-academy.service');
jest.mock('../content-moderation.service');
jest.mock('../elasticsearch.service');
jest.mock('../../utils/logger');

// Mock fetch for AI service calls
global.fetch = jest.fn();

describe('ContentService', () => {
  let contentService: ContentService;
  let mockContentRepository: jest.Mocked<ContentRepository>;
  let mockContentReportRepository: jest.Mocked<ContentReportRepository>;
  let mockYouTubeService: jest.Mocked<YouTubeService>;
  let mockKhanAcademyService: jest.Mocked<KhanAcademyService>;
  let mockModerationService: jest.Mocked<ContentModerationService>;

  const mockContentItem: ContentItem = {
    id: 'test-content-id',
    source: ContentSource.YOUTUBE,
    externalId: 'test-video-id',
    url: 'https://youtube.com/watch?v=test-video-id',
    title: 'Test Video Title',
    description: 'Test video description',
    thumbnailUrl: 'https://img.youtube.com/vi/test-video-id/hqdefault.jpg',
    metadata: {
      duration: 600,
      difficulty: DifficultyLevel.BEGINNER,
      subject: 'programming',
      topics: ['javascript', 'tutorial'],
      format: ContentFormat.VIDEO,
      language: 'en',
      learningObjectives: ['Learn JavaScript basics']
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
    // Create mocked instances
    mockContentRepository = new ContentRepository({} as any) as jest.Mocked<ContentRepository>;
    mockContentReportRepository = new ContentReportRepository({} as any) as jest.Mocked<ContentReportRepository>;
    mockYouTubeService = new YouTubeService() as jest.Mocked<YouTubeService>;
    mockKhanAcademyService = new KhanAcademyService() as jest.Mocked<KhanAcademyService>;
    mockModerationService = new ContentModerationService() as jest.Mocked<ContentModerationService>;

    // Create service instance with mocked dependencies
    contentService = new ContentService(mockContentRepository, mockContentReportRepository);
    
    // Replace the private services with mocks
    (contentService as any).youtubeService = mockYouTubeService;
    (contentService as any).khanAcademyService = mockKhanAcademyService;
    (contentService as any).moderationService = mockModerationService;
    (contentService as any).elasticsearchService = {
      searchContent: jest.fn(),
      getSuggestions: jest.fn(),
      getRelatedContent: jest.fn(),
      indexContent: jest.fn(),
      bulkIndexContent: jest.fn(),
      updateContent: jest.fn(),
      deleteContent: jest.fn(),
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('searchContent', () => {
    it('should search content successfully', async () => {
      // Arrange
      const query: ContentQuery = {
        query: 'javascript tutorial',
        subject: 'programming',
        difficulty: DifficultyLevel.BEGINNER
      };

      const expectedResult = {
        items: [mockContentItem],
        total: 1
      };

      mockContentRepository.search.mockResolvedValue(expectedResult);

      // Act
      const result = await contentService.searchContent(query);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockContentRepository.search).toHaveBeenCalledWith(query);
    });

    it('should handle search errors', async () => {
      // Arrange
      const query: ContentQuery = { query: 'test' };
      const error = new Error('Database error');
      mockContentRepository.search.mockRejectedValue(error);

      // Act & Assert
      await expect(contentService.searchContent(query)).rejects.toThrow('Database error');
    });
  });

  describe('getContentById', () => {
    it('should return content when found', async () => {
      // Arrange
      const contentId = 'test-content-id';
      mockContentRepository.findById.mockResolvedValue(mockContentItem);

      // Act
      const result = await contentService.getContentById(contentId);

      // Assert
      expect(result).toEqual(mockContentItem);
      expect(mockContentRepository.findById).toHaveBeenCalledWith(contentId);
    });

    it('should throw NotFoundError when content not found', async () => {
      // Arrange
      const contentId = 'non-existent-id';
      mockContentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(contentService.getContentById(contentId)).rejects.toThrow('Content not found');
    });
  });

  describe('validateContent', () => {
    it('should validate content successfully', async () => {
      // Arrange
      const contentId = 'test-content-id';
      mockContentRepository.findById.mockResolvedValue(mockContentItem);

      // Act
      const result = await contentService.validateContent(contentId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.ageAppropriate).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.issues).toEqual([]);
    });

    it('should identify validation issues', async () => {
      // Arrange
      const contentId = 'test-content-id';
      const invalidContent = {
        ...mockContentItem,
        metadata: {
          ...mockContentItem.metadata,
          duration: 0, // Invalid duration
          subject: 'general', // Generic subject
          learningObjectives: [] // Missing objectives
        },
        qualityMetrics: {
          ...mockContentItem.qualityMetrics,
          reportCount: 10, // High report count
          userRating: 1.5 // Low rating
        }
      };

      mockContentRepository.findById.mockResolvedValue(invalidContent);

      // Act
      const result = await contentService.validateContent(contentId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid duration');
      expect(result.issues).toContain('Subject classification needs improvement');
      expect(result.issues).toContain('Learning objectives are missing');
      expect(result.issues).toContain('High report count - content may be inappropriate');
      expect(result.issues).toContain('Low user rating');
    });

    it('should throw NotFoundError for non-existent content', async () => {
      // Arrange
      const contentId = 'non-existent-id';
      mockContentRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(contentService.validateContent(contentId)).rejects.toThrow('Content not found');
    });
  });

  describe('aggregateFromSources', () => {
    it('should aggregate content from multiple sources', async () => {
      // Arrange
      const options = {
        sources: [ContentSource.YOUTUBE, ContentSource.KHAN_ACADEMY],
        maxPerSource: 10,
        subjects: ['programming'],
        refreshExisting: false
      };

      // Mock YouTube aggregation
      const mockYouTubeVideos = [{
        id: 'youtube-video-1',
        title: 'JavaScript Tutorial',
        description: 'Learn JavaScript',
        thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-1/hqdefault.jpg',
        duration: 600,
        viewCount: 1000,
        likeCount: 100,
        publishedAt: new Date(),
        channelTitle: 'Test Channel',
        categoryId: '27',
        tags: ['javascript', 'tutorial']
      }];

      mockYouTubeService.searchVideos.mockResolvedValue(mockYouTubeVideos);
      mockYouTubeService.convertToContentItem.mockResolvedValue({
        source: ContentSource.YOUTUBE,
        externalId: 'youtube-video-1',
        url: 'https://youtube.com/watch?v=youtube-video-1',
        title: 'JavaScript Tutorial',
        description: 'Learn JavaScript',
        thumbnailUrl: 'https://img.youtube.com/vi/youtube-video-1/hqdefault.jpg',
        metadata: {
          duration: 600,
          difficulty: DifficultyLevel.BEGINNER,
          subject: 'programming',
          topics: ['javascript', 'tutorial'],
          format: ContentFormat.VIDEO,
          language: 'en',
          learningObjectives: ['Learn JavaScript basics']
        },
        qualityMetrics: {
          userRating: 4.0,
          completionRate: 0,
          effectivenessScore: 75,
          reportCount: 0,
          lastUpdated: new Date()
        },
        ageRating: AgeRating.ALL_AGES,
        isActive: true
      });

      // Mock Khan Academy aggregation
      const mockKhanContent = [{
        id: 'khan-video-1',
        title: 'Intro to Programming',
        kind: 'Video'
      }];

      mockKhanAcademyService.getContentBySubject.mockResolvedValue(mockKhanContent);
      mockKhanAcademyService.getVideo.mockResolvedValue({
        id: 'khan-video-1',
        title: 'Intro to Programming',
        description: 'Introduction to programming concepts',
        url: 'https://khanacademy.org/video/khan-video-1',
        youtubeId: 'khan-youtube-id',
        duration: 480,
        thumbnailUrl: 'https://khan-academy.org/thumb.jpg',
        slug: 'intro-programming',
        tags: ['programming', 'basics']
      });

      mockKhanAcademyService.convertVideoToContentItem.mockResolvedValue({
        source: ContentSource.KHAN_ACADEMY,
        externalId: 'khan-video-1',
        url: 'https://khanacademy.org/video/khan-video-1',
        title: 'Intro to Programming',
        description: 'Introduction to programming concepts',
        thumbnailUrl: 'https://khan-academy.org/thumb.jpg',
        metadata: {
          duration: 480,
          difficulty: DifficultyLevel.BEGINNER,
          subject: 'programming',
          topics: ['programming', 'basics'],
          format: ContentFormat.VIDEO,
          language: 'en',
          learningObjectives: ['Learn programming basics']
        },
        qualityMetrics: {
          userRating: 4.5,
          completionRate: 0,
          effectivenessScore: 85,
          reportCount: 0,
          lastUpdated: new Date()
        },
        ageRating: AgeRating.ALL_AGES,
        isActive: true
      });

      mockContentRepository.findByExternalId.mockResolvedValue(null);
      mockContentRepository.create.mockResolvedValue(mockContentItem);

      // Act
      await contentService.aggregateFromSources(options);

      // Assert
      expect(mockYouTubeService.searchVideos).toHaveBeenCalled();
      expect(mockKhanAcademyService.getContentBySubject).toHaveBeenCalled();
      expect(mockContentRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should handle aggregation errors gracefully', async () => {
      // Arrange
      const options = {
        sources: [ContentSource.YOUTUBE],
        maxPerSource: 10,
        subjects: ['programming'],
        refreshExisting: false
      };

      mockYouTubeService.searchVideos.mockRejectedValue(new Error('YouTube API error'));

      // Act & Assert
      // Should not throw error, but handle it gracefully
      await expect(contentService.aggregateFromSources(options)).resolves.not.toThrow();
    });
  });

  describe('updateMetadata', () => {
    it('should update content metadata successfully', async () => {
      // Arrange
      const contentId = 'test-content-id';
      const metadataUpdates = {
        difficulty: DifficultyLevel.INTERMEDIATE,
        topics: ['advanced-javascript']
      };

      const updatedContent = {
        ...mockContentItem,
        metadata: {
          ...mockContentItem.metadata,
          ...metadataUpdates
        }
      };

      mockContentRepository.update.mockResolvedValue(updatedContent);

      // Act
      const result = await contentService.updateMetadata(contentId, metadataUpdates);

      // Assert
      expect(result).toEqual(updatedContent);
      expect(mockContentRepository.update).toHaveBeenCalledWith(contentId, { 
        metadata: metadataUpdates 
      });
    });

    it('should throw NotFoundError when content not found', async () => {
      // Arrange
      const contentId = 'non-existent-id';
      const metadataUpdates = { difficulty: DifficultyLevel.INTERMEDIATE };
      mockContentRepository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(contentService.updateMetadata(contentId, metadataUpdates))
        .rejects.toThrow('Content not found');
    });
  });

  describe('getTopRatedContent', () => {
    it('should return top rated content', async () => {
      // Arrange
      const limit = 10;
      const topContent = [mockContentItem];
      mockContentRepository.getTopRated.mockResolvedValue(topContent);

      // Act
      const result = await contentService.getTopRatedContent(limit);

      // Assert
      expect(result).toEqual(topContent);
      expect(mockContentRepository.getTopRated).toHaveBeenCalledWith(limit);
    });
  });

  describe('getContentBySource', () => {
    it('should return content by source', async () => {
      // Arrange
      const source = ContentSource.YOUTUBE;
      const limit = 50;
      const sourceContent = [mockContentItem];
      mockContentRepository.getBySource.mockResolvedValue(sourceContent);

      // Act
      const result = await contentService.getContentBySource(source, limit);

      // Assert
      expect(result).toEqual(sourceContent);
      expect(mockContentRepository.getBySource).toHaveBeenCalledWith(source, limit);
    });
  });

  describe('moderateContent', () => {
    it('should moderate content and update based on results', async () => {
      // Arrange
      const contentId = 'test-content-id';
      const moderationResult = {
        isAppropriate: false,
        confidence: 0.9,
        flags: ['inappropriate_language'],
        suggestedAgeRating: AgeRating.TEEN,
        reason: 'Contains inappropriate language'
      };

      mockContentRepository.findById.mockResolvedValue(mockContentItem);
      mockModerationService.moderateContent.mockResolvedValue(moderationResult);
      mockContentRepository.update.mockResolvedValue({
        ...mockContentItem,
        isActive: false,
        ageRating: AgeRating.TEEN
      });

      // Act
      const result = await contentService.moderateContent(contentId);

      // Assert
      expect(result).toEqual(moderationResult);
      expect(mockModerationService.moderateContent).toHaveBeenCalledWith(mockContentItem);
      expect(mockContentRepository.update).toHaveBeenCalledWith(contentId, {
        isActive: false
      });
    });

    it('should update age rating when suggested rating differs', async () => {
      // Arrange
      const contentId = 'test-content-id';
      const moderationResult = {
        isAppropriate: true,
        confidence: 0.8,
        flags: [],
        suggestedAgeRating: AgeRating.TEEN,
        reason: 'Content is appropriate but for teens'
      };

      mockContentRepository.findById.mockResolvedValue(mockContentItem);
      mockModerationService.moderateContent.mockResolvedValue(moderationResult);
      mockContentRepository.update.mockResolvedValue({
        ...mockContentItem,
        ageRating: AgeRating.TEEN
      });

      // Act
      const result = await contentService.moderateContent(contentId);

      // Assert
      expect(result).toEqual(moderationResult);
      expect(mockContentRepository.update).toHaveBeenCalledWith(contentId, {
        ageRating: AgeRating.TEEN
      });
    });
  });

  describe('reportContent', () => {
    it('should create content report and update metrics', async () => {
      // Arrange
      const reportData: CreateReportRequest = {
        contentId: 'test-content-id',
        userId: 'user-123',
        reason: 'inappropriate',
        description: 'Contains inappropriate content',
        severity: 'medium'
      };

      const reportLimit = { canReport: true, maxReports: 10, currentReports: 2 };

      mockContentRepository.findById.mockResolvedValue(mockContentItem);
      mockContentReportRepository.checkUserReportLimit.mockResolvedValue(reportLimit);
      mockContentReportRepository.create.mockResolvedValue();
      mockContentRepository.update.mockResolvedValue({
        ...mockContentItem,
        qualityMetrics: {
          ...mockContentItem.qualityMetrics,
          reportCount: 1
        }
      });

      // Act
      await contentService.reportContent(reportData);

      // Assert
      expect(mockContentReportRepository.create).toHaveBeenCalledWith(reportData);
      expect(mockContentRepository.update).toHaveBeenCalledWith(reportData.contentId, {
        qualityMetrics: expect.objectContaining({
          reportCount: 1
        })
      });
    });

    it('should trigger moderation for high severity reports', async () => {
      // Arrange
      const reportData: CreateReportRequest = {
        contentId: 'test-content-id',
        userId: 'user-123',
        reason: 'inappropriate',
        description: 'Contains inappropriate content',
        severity: 'high'
      };

      const reportLimit = { canReport: true, maxReports: 10, currentReports: 2 };
      const moderationResult = {
        isAppropriate: false,
        confidence: 0.9,
        flags: ['inappropriate_content'],
        suggestedAgeRating: AgeRating.ADULT,
        reason: 'High severity report triggered moderation'
      };

      mockContentRepository.findById.mockResolvedValue(mockContentItem);
      mockContentReportRepository.checkUserReportLimit.mockResolvedValue(reportLimit);
      mockContentReportRepository.create.mockResolvedValue();
      mockContentRepository.update.mockResolvedValue(mockContentItem);
      mockModerationService.moderateContent.mockResolvedValue(moderationResult);

      // Act
      await contentService.reportContent(reportData);

      // Assert
      expect(mockModerationService.moderateContent).toHaveBeenCalledWith(mockContentItem);
    });

    it('should reject report when user exceeds limit', async () => {
      // Arrange
      const reportData: CreateReportRequest = {
        contentId: 'test-content-id',
        userId: 'user-123',
        reason: 'inappropriate',
        description: 'Contains inappropriate content',
        severity: 'medium'
      };

      const reportLimit = { canReport: false, maxReports: 10, currentReports: 10 };

      mockContentRepository.findById.mockResolvedValue(mockContentItem);
      mockContentReportRepository.checkUserReportLimit.mockResolvedValue(reportLimit);

      // Act & Assert
      await expect(contentService.reportContent(reportData)).rejects.toThrow('Report limit exceeded');
      expect(mockContentReportRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getRecommendations', () => {
    it('should return AI-powered recommendations', async () => {
      // Arrange
      const userId = 'user-123';
      const options = { subject: 'programming', limit: 5 };
      
      const aiResponse = {
        recommendations: [
          {
            content_id: 'content-1',
            title: 'JavaScript Basics',
            score: 0.95,
            reason: 'Matches your learning style'
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(aiResponse)
      });

      mockContentRepository.findById.mockResolvedValue(mockContentItem);

      // Act
      const result = await contentService.getRecommendations(userId, options);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recommendations/'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(userId)
        })
      );
    });

    it('should fallback to algorithmic recommendations when AI service fails', async () => {
      // Arrange
      const userId = 'user-123';
      const options = { subject: 'programming', limit: 5 };

      (global.fetch as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));
      
      const fallbackContent = [mockContentItem];
      mockContentRepository.search.mockResolvedValue({
        items: fallbackContent,
        total: 1
      });

      // Act
      const result = await contentService.getRecommendations(userId, options);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('filterContentForUser', () => {
    it('should filter content based on user age and parental controls', async () => {
      // Arrange
      const content = [mockContentItem];
      const userAgeRange = '13-17';
      const parentalControls = {
        contentFiltering: 'strict',
        restrictedInteractions: true
      };

      const filteredContent = [mockContentItem];
      mockModerationService.filterContentForUser.mockResolvedValue(filteredContent);

      // Act
      const result = await contentService.filterContentForUser(content, userAgeRange, parentalControls);

      // Assert
      expect(result).toEqual(filteredContent);
      expect(mockModerationService.filterContentForUser).toHaveBeenCalledWith(
        content,
        userAgeRange,
        parentalControls
      );
    });
  });

  describe('searchContentWithFiltering', () => {
    it('should search and filter content for user', async () => {
      // Arrange
      const query: ContentQuery = { query: 'javascript tutorial' };
      const userAgeRange = '13-17';
      const parentalControls = { contentFiltering: 'moderate' };

      const searchResult = {
        items: [mockContentItem],
        total: 1
      };

      const filteredContent = [mockContentItem];

      mockContentRepository.search.mockResolvedValue(searchResult);
      mockModerationService.filterContentForUser.mockResolvedValue(filteredContent);

      // Act
      const result = await contentService.searchContentWithFiltering(query, userAgeRange, parentalControls);

      // Assert
      expect(result.items).toEqual(filteredContent);
      expect(result.total).toBe(1);
      expect(mockModerationService.filterContentForUser).toHaveBeenCalledWith(
        searchResult.items,
        userAgeRange,
        parentalControls
      );
    });
  });

  describe('validateAndModerateNewContent', () => {
    it('should validate and moderate new content', async () => {
      // Arrange
      const newContentData = {
        source: ContentSource.YOUTUBE,
        externalId: 'new-video-id',
        url: 'https://youtube.com/watch?v=new-video-id',
        title: 'New Video',
        description: 'New video description',
        metadata: mockContentItem.metadata,
        qualityMetrics: mockContentItem.qualityMetrics,
        ageRating: AgeRating.ALL_AGES,
        isActive: true
      };

      const createdContent = { ...mockContentItem, id: 'new-content-id' };
      const moderationResult = {
        isAppropriate: true,
        confidence: 0.8,
        flags: [],
        suggestedAgeRating: AgeRating.ALL_AGES,
        reason: 'Content is appropriate'
      };

      const qualityAssessment = {
        overallScore: 85,
        recommendations: ['Good educational content'],
        strengths: ['Clear explanation'],
        weaknesses: []
      };

      mockContentRepository.create.mockResolvedValue(createdContent);
      mockModerationService.moderateContent.mockResolvedValue(moderationResult);
      mockModerationService.assessContentQuality.mockResolvedValue(qualityAssessment);
      mockContentRepository.findById.mockResolvedValue(createdContent);

      // Act
      const result = await contentService.validateAndModerateNewContent(newContentData);

      // Assert
      expect(result).toEqual(createdContent);
      expect(mockContentRepository.create).toHaveBeenCalledWith(newContentData);
      expect(mockModerationService.moderateContent).toHaveBeenCalledWith(createdContent);
      expect(mockModerationService.assessContentQuality).toHaveBeenCalledWith(createdContent);
    });
  });
});