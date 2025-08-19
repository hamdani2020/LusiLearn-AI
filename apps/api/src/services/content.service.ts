import { ContentRepository, CreateContentRequest } from '../repositories/content.repository';
import { ContentReportRepository, CreateReportRequest } from '../repositories/content-report.repository';
import { YouTubeService, YouTubeSearchOptions } from './external/youtube.service';
import { KhanAcademyService } from './external/khan-academy.service';
import { ContentModerationService, ModerationResult, QualityAssessment } from './content-moderation.service';
import { ElasticsearchService, ContentSearchQuery, SearchResult } from './elasticsearch.service';
import { CacheService } from '../cache/cache-service';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import {
  ContentItem,
  ContentQuery,
  ContentRecommendation,
  ValidationResult,
  ContentSource,
  ContentMetadata,
  QualityMetrics,
  DifficultyLevel,
  AgeRating,
  ContentFormat
} from '@lusilearn/shared-types';

export interface ContentAggregationOptions {
  sources?: ContentSource[];
  maxPerSource?: number;
  subjects?: string[];
  refreshExisting?: boolean;
}

export interface QualityScoreFactors {
  userRating: number;
  completionRate: number;
  effectivenessScore: number;
  reportCount: number;
  sourceReliability: number;
}

export class ContentService {
  private contentRepository: ContentRepository;
  private contentReportRepository: ContentReportRepository;
  private youtubeService: YouTubeService;
  private khanAcademyService: KhanAcademyService;
  private moderationService: ContentModerationService;
  private elasticsearchService: ElasticsearchService;
  private aiServiceUrl: string;

  constructor(contentRepository: ContentRepository, contentReportRepository: ContentReportRepository) {
    this.contentRepository = contentRepository;
    this.contentReportRepository = contentReportRepository;
    this.youtubeService = new YouTubeService();
    this.khanAcademyService = new KhanAcademyService();
    this.moderationService = new ContentModerationService();
    this.elasticsearchService = new ElasticsearchService();
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  }

  async searchContent(query: ContentQuery): Promise<{ items: ContentItem[], total: number }> {
    try {
      logger.info('Searching content:', { query: query.query, filters: query });

      const result = await this.contentRepository.search(query);

      logger.info('Content search completed:', {
        query: query.query,
        resultsCount: result.items.length,
        total: result.total
      });

      return result;
    } catch (error) {
      logger.error('Error searching content:', error);
      throw error;
    }
  }

  async getContentById(id: string): Promise<ContentItem> {
    try {
      const content = await this.contentRepository.findById(id);
      if (!content) {
        throw new NotFoundError('Content not found');
      }
      return content;
    } catch (error) {
      logger.error('Error getting content by ID:', error);
      throw error;
    }
  }

  async aggregateFromSources(options: ContentAggregationOptions = {}): Promise<void> {
    try {
      const {
        sources = [ContentSource.YOUTUBE, ContentSource.KHAN_ACADEMY],
        maxPerSource = 50,
        subjects = ['mathematics', 'programming', 'science', 'physics', 'chemistry'],
        refreshExisting = false
      } = options;

      logger.info('Starting content aggregation:', { sources, maxPerSource, subjects });

      const aggregationPromises = sources.map(source =>
        this.aggregateFromSource(source, subjects, maxPerSource, refreshExisting)
      );

      await Promise.allSettled(aggregationPromises);

      logger.info('Content aggregation completed');
    } catch (error) {
      logger.error('Error during content aggregation:', error);
      throw error;
    }
  }

  async aggregateFromSource(
    source: ContentSource,
    subjects: string[],
    maxPerSource: number,
    refreshExisting: boolean
  ): Promise<void> {
    try {
      logger.info(`Aggregating content from ${source}:`, { subjects, maxPerSource });

      switch (source) {
        case ContentSource.YOUTUBE:
          await this.aggregateFromYouTube(subjects, maxPerSource, refreshExisting);
          break;
        case ContentSource.KHAN_ACADEMY:
          await this.aggregateFromKhanAcademy(subjects, maxPerSource, refreshExisting);
          break;
        default:
          logger.warn(`Unsupported content source: ${source}`);
      }
    } catch (error) {
      logger.error(`Error aggregating from ${source}:`, error);
      // Don't throw - allow other sources to continue
    }
  }

  private async aggregateFromYouTube(subjects: string[], maxPerSubject: number, refreshExisting: boolean): Promise<void> {
    try {
      for (const subject of subjects) {
        logger.info(`Aggregating YouTube content for subject: ${subject}`);

        const searchOptions: YouTubeSearchOptions = {
          query: `${subject} tutorial education learn`,
          maxResults: Math.min(maxPerSubject, 50), // YouTube API limit
          order: 'relevance',
          duration: 'medium' // 4-20 minutes, good for educational content
        };

        const videos = await this.youtubeService.searchVideos(searchOptions);

        for (const video of videos) {
          try {
            // Check if content already exists
            const existing = await this.contentRepository.findByExternalId(
              ContentSource.YOUTUBE,
              video.id
            );

            if (existing && !refreshExisting) {
              continue;
            }

            const contentItem = await this.youtubeService.convertToContentItem(video);

            if (existing && refreshExisting) {
              // Update existing content
              await this.contentRepository.update(existing.id, {
                title: contentItem.title,
                description: contentItem.description,
                thumbnailUrl: contentItem.thumbnailUrl,
                metadata: contentItem.metadata,
                qualityMetrics: contentItem.qualityMetrics
              });
            } else {
              // Create new content
              await this.contentRepository.create(contentItem as CreateContentRequest);
            }

            logger.debug(`Processed YouTube video: ${video.title}`);
          } catch (error) {
            logger.error(`Error processing YouTube video ${video.id}:`, error);
            continue;
          }
        }

        // Add delay to respect rate limits
        await this.delay(1000);
      }
    } catch (error) {
      logger.error('Error aggregating from YouTube:', error);
      throw error;
    }
  }

  private async aggregateFromKhanAcademy(subjects: string[], maxPerSubject: number, refreshExisting: boolean): Promise<void> {
    try {
      for (const subject of subjects) {
        logger.info(`Aggregating Khan Academy content for subject: ${subject}`);

        const contentItems = await this.khanAcademyService.getContentBySubject(subject, maxPerSubject);

        for (const item of contentItems) {
          try {
            // Check if content already exists
            const existing = await this.contentRepository.findByExternalId(
              ContentSource.KHAN_ACADEMY,
              item.id
            );

            if (existing && !refreshExisting) {
              continue;
            }

            let contentItem;

            // Convert based on content type
            switch (item.kind) {
              case 'Video':
                const video = await this.khanAcademyService.getVideo(item.id);
                if (video) {
                  contentItem = await this.khanAcademyService.convertVideoToContentItem(video);
                }
                break;
              case 'Exercise':
                const exercise = await this.khanAcademyService.getExercise(item.id);
                if (exercise) {
                  contentItem = await this.khanAcademyService.convertExerciseToContentItem(exercise);
                }
                break;
              case 'Article':
                const article = await this.khanAcademyService.getArticle(item.id);
                if (article) {
                  contentItem = await this.khanAcademyService.convertArticleToContentItem(article);
                }
                break;
              default:
                continue;
            }

            if (!contentItem) continue;

            if (existing && refreshExisting) {
              // Update existing content
              await this.contentRepository.update(existing.id, {
                title: contentItem.title,
                description: contentItem.description,
                metadata: contentItem.metadata,
                qualityMetrics: contentItem.qualityMetrics
              });
            } else {
              // Create new content
              await this.contentRepository.create(contentItem as CreateContentRequest);
            }

            logger.debug(`Processed Khan Academy ${item.kind}: ${item.title}`);
          } catch (error) {
            logger.error(`Error processing Khan Academy item ${item.id}:`, error);
            continue;
          }
        }

        // Add delay to be respectful to Khan Academy's servers
        await this.delay(500);
      }
    } catch (error) {
      logger.error('Error aggregating from Khan Academy:', error);
      throw error;
    }
  }

  async validateContent(contentId: string): Promise<ValidationResult> {
    try {
      const content = await this.contentRepository.findById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }

      const validation: ValidationResult = {
        isValid: true,
        issues: [],
        ageAppropriate: true,
        qualityScore: 0
      };

      // Validate metadata completeness
      if (!content.metadata.subject || content.metadata.subject === 'general') {
        validation.issues.push('Subject classification needs improvement');
      }

      if (!content.metadata.learningObjectives || content.metadata.learningObjectives.length === 0) {
        validation.issues.push('Learning objectives are missing');
      }

      if (content.metadata.duration <= 0) {
        validation.issues.push('Invalid duration');
        validation.isValid = false;
      }

      // Validate quality metrics
      if (content.qualityMetrics.reportCount > 5) {
        validation.issues.push('High report count - content may be inappropriate');
        validation.isValid = false;
      }

      if (content.qualityMetrics.userRating < 2.0) {
        validation.issues.push('Low user rating');
      }

      // Age appropriateness check
      validation.ageAppropriate = this.validateAgeAppropriateness(content);
      if (!validation.ageAppropriate) {
        validation.issues.push('Content may not be age-appropriate');
      }

      // Calculate overall quality score
      validation.qualityScore = this.calculateQualityScore({
        userRating: content.qualityMetrics.userRating,
        completionRate: content.qualityMetrics.completionRate,
        effectivenessScore: content.qualityMetrics.effectivenessScore,
        reportCount: content.qualityMetrics.reportCount,
        sourceReliability: this.getSourceReliabilityScore(content.source)
      });

      logger.info('Content validation completed:', {
        contentId,
        isValid: validation.isValid,
        qualityScore: validation.qualityScore
      });

      return validation;
    } catch (error) {
      logger.error('Error validating content:', error);
      throw error;
    }
  }

  async updateMetadata(contentId: string, metadata: Partial<ContentMetadata>): Promise<ContentItem> {
    try {
      const updatedContent = await this.contentRepository.update(contentId, { metadata });
      if (!updatedContent) {
        throw new NotFoundError('Content not found');
      }

      logger.info('Content metadata updated:', { contentId, updatedFields: Object.keys(metadata) });
      return updatedContent;
    } catch (error) {
      logger.error('Error updating content metadata:', error);
      throw error;
    }
  }

  async getTopRatedContent(limit: number = 20): Promise<ContentItem[]> {
    try {
      return await this.contentRepository.getTopRated(limit);
    } catch (error) {
      logger.error('Error getting top rated content:', error);
      throw error;
    }
  }

  async getContentBySource(source: ContentSource, limit: number = 100): Promise<ContentItem[]> {
    try {
      return await this.contentRepository.getBySource(source, limit);
    } catch (error) {
      logger.error('Error getting content by source:', error);
      throw error;
    }
  }

  async moderateContent(contentId: string): Promise<ModerationResult> {
    try {
      const content = await this.contentRepository.findById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }

      const moderationResult = await this.moderationService.moderateContent(content);

      // Update content based on moderation result
      if (!moderationResult.isAppropriate) {
        await this.contentRepository.update(contentId, {
          isActive: false // Deactivate inappropriate content
        });

        // Update quality metrics to reflect moderation issues
        const updatedQualityMetrics = {
          ...content.qualityMetrics,
          reportCount: content.qualityMetrics.reportCount + 1,
          effectivenessScore: Math.max(0, content.qualityMetrics.effectivenessScore - 20)
        };

        await this.contentRepository.update(contentId, {
          qualityMetrics: updatedQualityMetrics
        });
      }

      // Update age rating if suggested rating is different
      if (moderationResult.suggestedAgeRating !== content.ageRating) {
        await this.contentRepository.update(contentId, {
          ageRating: moderationResult.suggestedAgeRating
        });
      }

      logger.info('Content moderation completed:', {
        contentId,
        isAppropriate: moderationResult.isAppropriate,
        confidence: moderationResult.confidence,
        flags: moderationResult.flags
      });

      return moderationResult;
    } catch (error) {
      logger.error('Error moderating content:', error);
      throw error;
    }
  }

  async assessContentQuality(contentId: string): Promise<QualityAssessment> {
    try {
      const content = await this.contentRepository.findById(contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }

      const qualityAssessment = await this.moderationService.assessContentQuality(content);

      // Update content quality metrics based on assessment
      const updatedQualityMetrics = {
        ...content.qualityMetrics,
        effectivenessScore: qualityAssessment.overallScore,
        lastUpdated: new Date()
      };

      await this.contentRepository.update(contentId, {
        qualityMetrics: updatedQualityMetrics
      });

      logger.info('Content quality assessment completed:', {
        contentId,
        overallScore: qualityAssessment.overallScore,
        recommendations: qualityAssessment.recommendations
      });

      return qualityAssessment;
    } catch (error) {
      logger.error('Error assessing content quality:', error);
      throw error;
    }
  }

  async filterContentForUser(
    content: ContentItem[],
    userAgeRange: string,
    parentalControls?: any
  ): Promise<ContentItem[]> {
    try {
      return await this.moderationService.filterContentForUser(
        content,
        userAgeRange,
        parentalControls
      );
    } catch (error) {
      logger.error('Error filtering content for user:', error);
      throw error;
    }
  }

  async reportContent(reportData: CreateReportRequest): Promise<void> {
    try {
      // Check if content exists
      const content = await this.contentRepository.findById(reportData.contentId);
      if (!content) {
        throw new NotFoundError('Content not found');
      }

      // Check user report limits
      const reportLimit = await this.contentReportRepository.checkUserReportLimit(reportData.userId);
      if (!reportLimit.canReport) {
        throw new ValidationError(
          `Report limit exceeded. You can only submit ${reportLimit.maxReports} reports per 24 hours.`
        );
      }

      // Create the report
      await this.contentReportRepository.create(reportData);

      // Update content quality metrics
      const updatedQualityMetrics = {
        ...content.qualityMetrics,
        reportCount: content.qualityMetrics.reportCount + 1,
        lastUpdated: new Date()
      };

      await this.contentRepository.update(reportData.contentId, {
        qualityMetrics: updatedQualityMetrics
      });

      // If high severity or multiple reports, trigger automatic moderation
      if (reportData.severity === 'high' || content.qualityMetrics.reportCount >= 3) {
        await this.moderateContent(reportData.contentId);
      }

      logger.info('Content reported:', {
        contentId: reportData.contentId,
        userId: reportData.userId,
        reason: reportData.reason,
        severity: reportData.severity
      });
    } catch (error) {
      logger.error('Error reporting content:', error);
      throw error;
    }
  }

  async getContentReports(contentId: string): Promise<any[]> {
    try {
      return await this.contentReportRepository.findByContentId(contentId);
    } catch (error) {
      logger.error('Error getting content reports:', error);
      throw error;
    }
  }

  async getPendingReports(limit: number = 50): Promise<any[]> {
    try {
      return await this.contentReportRepository.findPendingReports(limit);
    } catch (error) {
      logger.error('Error getting pending reports:', error);
      throw error;
    }
  }

  async resolveReport(reportId: string, resolution: string, reviewerId: string): Promise<void> {
    try {
      await this.contentReportRepository.update(reportId, {
        status: 'resolved',
        reviewedBy: reviewerId,
        resolution
      });

      logger.info('Report resolved:', { reportId, reviewerId, resolution });
    } catch (error) {
      logger.error('Error resolving report:', error);
      throw error;
    }
  }

  async getContentReportStats(contentId: string): Promise<any> {
    try {
      return await this.contentReportRepository.getReportStatsByContent(contentId);
    } catch (error) {
      logger.error('Error getting content report stats:', error);
      throw error;
    }
  }

  async searchContentWithFiltering(
    query: ContentQuery,
    userAgeRange: string,
    parentalControls?: any
  ): Promise<{ items: ContentItem[], total: number }> {
    try {
      // First, get the raw search results
      const searchResult = await this.searchContent(query);

      // Then filter the results for the user
      const filteredItems = await this.filterContentForUser(
        searchResult.items,
        userAgeRange,
        parentalControls
      );

      logger.info('Content search with filtering completed:', {
        query: query.query,
        originalCount: searchResult.items.length,
        filteredCount: filteredItems.length,
        userAgeRange
      });

      return {
        items: filteredItems,
        total: filteredItems.length // Note: This is the filtered total, not the original total
      };
    } catch (error) {
      logger.error('Error searching content with filtering:', error);
      throw error;
    }
  }

  async validateAndModerateNewContent(contentItem: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> {
    try {
      // Create the content item first
      const createdContent = await this.contentRepository.create(contentItem as CreateContentRequest);

      // Run moderation on the new content
      const moderationResult = await this.moderateContent(createdContent.id);

      // Run quality assessment
      const qualityAssessment = await this.assessContentQuality(createdContent.id);

      logger.info('New content validated and moderated:', {
        contentId: createdContent.id,
        isAppropriate: moderationResult.isAppropriate,
        qualityScore: qualityAssessment.overallScore
      });

      // Return the updated content
      return await this.getContentById(createdContent.id);
    } catch (error) {
      logger.error('Error validating and moderating new content:', error);
      throw error;
    }
  }

  private validateAgeAppropriateness(content: ContentItem): boolean {
    // Basic age appropriateness validation
    const title = content.title.toLowerCase();
    const description = content.description.toLowerCase();

    // Check for inappropriate keywords
    const inappropriateKeywords = [
      'explicit', 'adult', 'mature', 'violence', 'inappropriate'
    ];

    return !inappropriateKeywords.some(keyword =>
      title.includes(keyword) || description.includes(keyword)
    );
  }

  private calculateQualityScore(factors: QualityScoreFactors): number {
    const {
      userRating,
      completionRate,
      effectivenessScore,
      reportCount,
      sourceReliability
    } = factors;

    // Weighted quality score calculation
    let score = 0;

    // User rating (0-5 scale, weight: 25%)
    score += (userRating / 5) * 25;

    // Completion rate (0-100 scale, weight: 20%)
    score += (completionRate / 100) * 20;

    // Effectiveness score (0-100 scale, weight: 25%)
    score += (effectivenessScore / 100) * 25;

    // Source reliability (0-100 scale, weight: 20%)
    score += (sourceReliability / 100) * 20;

    // Penalty for reports (subtract 2 points per report, max 10 points)
    score -= Math.min(reportCount * 2, 10);

    // Penalty for low engagement
    if (completionRate < 30) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private getSourceReliabilityScore(source: ContentSource): number {
    // Source reliability scores based on content quality and moderation
    const reliabilityScores = {
      [ContentSource.KHAN_ACADEMY]: 95, // Highly curated educational content
      [ContentSource.COURSERA]: 90,     // Professional courses
      [ContentSource.YOUTUBE]: 70,      // Variable quality, depends on creator
      [ContentSource.GITHUB]: 75,       // Technical content, community-driven
      [ContentSource.INTERNAL]: 85      // Our own curated content
    };

    return reliabilityScores[source] || 50;
  }

  // Enhanced search methods using Elasticsearch
  async searchContentAdvanced(searchQuery: ContentSearchQuery): Promise<SearchResult> {
    try {
      logger.info('Advanced content search:', { query: searchQuery.query, filters: searchQuery.filters });

      const result = await this.elasticsearchService.searchContent(searchQuery);

      logger.info('Advanced content search completed:', {
        query: searchQuery.query,
        resultsCount: result.items.length,
        total: result.total
      });

      return result;
    } catch (error) {
      logger.error('Error in advanced content search:', error);
      // Fallback to database search if Elasticsearch fails
      const fallbackQuery: ContentQuery = {
        query: searchQuery.query,
        subject: searchQuery.filters?.subject,
        difficulty: searchQuery.filters?.difficulty,
        format: searchQuery.filters?.format,
        ageRating: searchQuery.filters?.ageRating,
        duration: searchQuery.filters?.duration,
        page: searchQuery.page,
        limit: searchQuery.size
      };

      const fallbackResult = await this.searchContent(fallbackQuery);
      return {
        items: fallbackResult.items,
        total: fallbackResult.total
      };
    }
  }

  async getContentSuggestions(query: string, size: number = 5): Promise<string[]> {
    try {
      return await this.elasticsearchService.getSuggestions(query, size);
    } catch (error) {
      logger.error('Error getting content suggestions:', error);
      return [];
    }
  }

  async getRelatedContent(contentId: string, size: number = 5): Promise<ContentItem[]> {
    try {
      return await this.elasticsearchService.getRelatedContent(contentId, size);
    } catch (error) {
      logger.error('Error getting related content:', error);
      // Fallback: get content from same subject
      const content = await this.getContentById(contentId);
      const relatedQuery: ContentQuery = {
        query: '',
        subject: content.metadata.subject,
        limit: size
      };
      const fallbackResult = await this.searchContent(relatedQuery);
      return fallbackResult.items.filter(item => item.id !== contentId);
    }
  }

  async indexContentForSearch(content: ContentItem): Promise<void> {
    try {
      await this.elasticsearchService.indexContent(content);
      logger.debug('Content indexed for search:', { contentId: content.id });
    } catch (error) {
      logger.error('Error indexing content for search:', error);
      // Don't throw error - search indexing is not critical for core functionality
    }
  }

  async bulkIndexContentForSearch(contentItems: ContentItem[]): Promise<void> {
    try {
      await this.elasticsearchService.bulkIndexContent(contentItems);
      logger.info('Bulk content indexed for search:', { count: contentItems.length });
    } catch (error) {
      logger.error('Error bulk indexing content for search:', error);
      // Don't throw error - search indexing is not critical for core functionality
    }
  }

  async updateContentInSearchIndex(contentId: string, updates: Partial<ContentItem>): Promise<void> {
    try {
      await this.elasticsearchService.updateContent(contentId, updates);
      logger.debug('Content updated in search index:', { contentId });
    } catch (error) {
      logger.error('Error updating content in search index:', error);
      // Don't throw error - search indexing is not critical for core functionality
    }
  }

  async removeContentFromSearchIndex(contentId: string): Promise<void> {
    try {
      await this.elasticsearchService.deleteContent(contentId);
      logger.debug('Content removed from search index:', { contentId });
    } catch (error) {
      logger.error('Error removing content from search index:', error);
      // Don't throw error - search indexing is not critical for core functionality
    }
  }

  async getRecommendations(userId: string, options: {
    subject?: string;
    limit?: number;
  } = {}): Promise<ContentRecommendation[]> {
    try {
      const { subject, limit = 10 } = options;

      logger.info('Getting AI-powered recommendations:', { userId, subject, limit });

      // Check cache first
      const cacheKey = `recommendations:${userId}:${subject || 'general'}:${limit}`;
      const cachedRecommendations = await CacheService.getTempData<ContentRecommendation[]>(cacheKey);
      
      if (cachedRecommendations && cachedRecommendations.length > 0) {
        logger.info('Returning cached recommendations:', { userId, count: cachedRecommendations.length });
        return cachedRecommendations;
      }

      // Try to get AI-powered recommendations first
      try {
        const aiRecommendations = await this.getAIRecommendations(userId, subject, limit);
        if (aiRecommendations && aiRecommendations.length > 0) {
          logger.info('Successfully retrieved AI-powered recommendations:', {
            userId,
            count: aiRecommendations.length
          });
          
          // Cache the recommendations for 5 minutes
          await CacheService.setTempData(cacheKey, aiRecommendations, 300);
          
          return aiRecommendations;
        }
      } catch (aiError) {
        logger.warn('AI service unavailable, falling back to algorithmic recommendations', { 
          error: aiError,
          userId 
        });
      }

      // Fallback to algorithmic recommendations
      const algorithmicRecommendations = await this.getAlgorithmicRecommendations(userId, options);
      
      // Cache algorithmic recommendations for 2 minutes
      await CacheService.setTempData(cacheKey, algorithmicRecommendations, 120);
      
      return algorithmicRecommendations;
    } catch (error) {
      logger.error('Error getting content recommendations:', error);
      throw error;
    }
  }

  private async getAIRecommendations(userId: string, subject?: string, limit: number = 10): Promise<ContentRecommendation[]> {
    try {
      const requestBody = {
        user_id: userId,
        current_topic: subject || 'general',
        education_level: 'college',
        skill_level: 'intermediate',
        learning_context: 'self_paced',
        preferred_formats: ['video', 'article'],
        max_duration: 60,
        exclude_content: []
      };

      const response = await fetch(`${this.aiServiceUrl}/api/v1/recommendations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`AI service responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error('Invalid response format from AI service');
      }

      // Convert AI service recommendations to our format
      const recommendations: ContentRecommendation[] = [];
      
      for (const aiRec of data.recommendations) {
        // Try to find the content in our database
        let content: ContentItem | null = null;
        
        if (aiRec.content_id) {
          content = await this.contentRepository.findById(aiRec.content_id);
        }
        
        if (!content && aiRec.external_id) {
          content = await this.contentRepository.findByExternalId(
            aiRec.source as ContentSource || ContentSource.YOUTUBE,
            aiRec.external_id
          );
        }

        // If content not found, try to find real YouTube content based on AI recommendation
        if (!content && aiRec.source === 'youtube') {
          logger.info(`Attempting YouTube search for AI recommendation: ${aiRec.title}`);
          try {
            const youtubeService = new (await import('./external/youtube.service')).YouTubeService();
            const searchQuery = aiRec.title || `${aiRec.subject || subject} tutorial`;
            logger.info(`Searching YouTube with query: ${searchQuery}`);
            
            const youtubeVideos = await youtubeService.searchVideos({
              query: searchQuery,
              maxResults: 1,
              order: 'relevance'
            });
            
            logger.info(`YouTube search returned ${youtubeVideos.length} videos`);
            
            if (youtubeVideos.length > 0) {
              const video = youtubeVideos[0];
              logger.info(`Converting YouTube video: ${video.title}`);
              const youtubeContent = await youtubeService.convertToContentItem(video);
              content = {
                ...youtubeContent,
                id: aiRec.content_id || `ai-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
                updatedAt: new Date()
              };
              logger.info(`Successfully created YouTube content: ${content.title} - ${content.url}`);
            }
          } catch (error) {
            logger.error(`Failed to search YouTube for AI recommendation: ${error}`);
          }
        }

        // If still no content found, create a placeholder
        if (!content) {
          content = {
            id: aiRec.content_id || `ai-${Date.now()}-${Math.random()}`,
            title: aiRec.title || 'AI Recommended Content',
            description: aiRec.description || 'Content recommended by our AI system',
            url: aiRec.url || '',
            source: aiRec.source as ContentSource || ContentSource.YOUTUBE,
            externalId: aiRec.external_id || '',
            metadata: {
              subject: aiRec.subject || subject || 'general',
              topics: aiRec.topics || [],
              difficulty: aiRec.difficulty || DifficultyLevel.INTERMEDIATE,
              duration: aiRec.duration || 0,
              format: ContentFormat.VIDEO,
              language: 'en',
              learningObjectives: aiRec.learning_objectives || [],
              prerequisites: aiRec.prerequisites || []
            },
            qualityMetrics: {
              userRating: aiRec.quality_score || 0,
              effectivenessScore: aiRec.effectiveness_score || 0,
              completionRate: aiRec.completion_rate || 0,
              reportCount: 0,
              lastUpdated: new Date()
            },
            ageRating: AgeRating.ALL_AGES,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }

        if (content) {
          recommendations.push({
            content,
            relevanceScore: aiRec.relevance_score || 0.8,
            reason: aiRec.reason || 'AI-powered recommendation based on your learning profile',
            matchedSkills: aiRec.matched_skills || []
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error getting AI recommendations:', error);
      throw error;
    }
  }

  private async getAlgorithmicRecommendations(userId: string, options: {
    subject?: string;
    limit?: number;
  } = {}): Promise<ContentRecommendation[]> {
    try {
      const { subject, limit = 10 } = options;

      const query: ContentQuery = {
        subject,
        limit: limit * 2, // Get more items to filter and rank
        page: 1
      };

      const searchResult = await this.searchContent(query);
      const recommendations: ContentRecommendation[] = [];

      for (const content of searchResult.items) {
        // Calculate relevance score based on various factors
        let relevanceScore = 0;
        let reason = '';
        const matchedSkills: string[] = [];

        // Base score from quality metrics
        relevanceScore += content.qualityMetrics.userRating * 0.2;
        relevanceScore += content.qualityMetrics.effectivenessScore * 0.3;
        relevanceScore += content.qualityMetrics.completionRate * 0.2;

        // Subject match bonus
        if (subject && content.metadata.subject && content.metadata.subject.toLowerCase().includes(subject.toLowerCase())) {
          relevanceScore += 0.3;
          reason = `Matches your interest in ${subject}`;
          matchedSkills.push(subject);
        } else {
          reason = 'Algorithmic recommendation based on quality metrics';
        }

        // Penalty for high report count
        if (content.qualityMetrics.reportCount > 0) {
          relevanceScore -= content.qualityMetrics.reportCount * 0.1;
        }

        // Normalize score to 0-1 range
        relevanceScore = Math.max(0, Math.min(1, relevanceScore));

        recommendations.push({
          content,
          relevanceScore,
          reason,
          matchedSkills
        });
      }

      // Sort by relevance score and return top results
      recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

      logger.info('Generated algorithmic recommendations:', {
        userId,
        subject,
        recommendationsCount: recommendations.length,
        topScore: recommendations[0]?.relevanceScore
      });

      return recommendations.slice(0, limit);
    } catch (error) {
      logger.error('Error getting algorithmic recommendations:', error);
      throw error;
    }
  }

  async categorizeContent(content: ContentItem): Promise<{
    primaryCategory: string;
    secondaryCategories: string[];
    tags: string[]
  }> {
    try {
      const title = content.title.toLowerCase();
      const description = content.description.toLowerCase();
      const topics = content.metadata.topics.map(topic => topic.toLowerCase());
      const text = `${title} ${description} ${topics.join(' ')}`;

      // Define category mappings
      const categoryMappings = {
        'programming': {
          keywords: ['programming', 'coding', 'javascript', 'python', 'java', 'react', 'node', 'web development', 'software'],
          subcategories: ['web-development', 'mobile-development', 'backend', 'frontend', 'algorithms', 'data-structures']
        },
        'mathematics': {
          keywords: ['math', 'mathematics', 'algebra', 'calculus', 'geometry', 'statistics', 'trigonometry'],
          subcategories: ['algebra', 'calculus', 'geometry', 'statistics', 'discrete-math', 'applied-math']
        },
        'science': {
          keywords: ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'earth science'],
          subcategories: ['physics', 'chemistry', 'biology', 'earth-science', 'astronomy', 'environmental-science']
        },
        'data-science': {
          keywords: ['data science', 'machine learning', 'ai', 'artificial intelligence', 'analytics', 'statistics'],
          subcategories: ['machine-learning', 'deep-learning', 'data-analysis', 'visualization', 'big-data']
        },
        'business': {
          keywords: ['business', 'management', 'marketing', 'finance', 'economics', 'entrepreneurship'],
          subcategories: ['management', 'marketing', 'finance', 'economics', 'strategy', 'leadership']
        }
      };

      let primaryCategory = 'general';
      const secondaryCategories: string[] = [];
      const tags: string[] = [];

      // Find primary category
      let maxScore = 0;
      for (const [category, config] of Object.entries(categoryMappings)) {
        const score = config.keywords.filter(keyword => text.includes(keyword)).length;
        if (score > maxScore) {
          maxScore = score;
          primaryCategory = category;
        }
      }

      // Find secondary categories
      if (primaryCategory !== 'general') {
        const primaryConfig = categoryMappings[primaryCategory as keyof typeof categoryMappings];
        for (const subcategory of primaryConfig.subcategories) {
          if (text.includes(subcategory.replace('-', ' ')) || text.includes(subcategory)) {
            secondaryCategories.push(subcategory);
          }
        }
      }

      // Extract tags from topics and difficulty
      tags.push(...topics);
      tags.push(content.metadata.difficulty);
      tags.push(content.metadata.format);
      tags.push(content.source);

      // Add duration-based tags
      const duration = content.metadata.duration;
      if (duration < 300) tags.push('short');
      else if (duration < 1800) tags.push('medium');
      else tags.push('long');

      // Remove duplicates
      const uniqueTags = [...new Set(tags)];

      logger.debug('Content categorized:', {
        contentId: content.id,
        primaryCategory,
        secondaryCategories,
        tags: uniqueTags
      });

      return {
        primaryCategory,
        secondaryCategories,
        tags: uniqueTags
      };
    } catch (error) {
      logger.error('Error categorizing content:', error);
      return {
        primaryCategory: 'general',
        secondaryCategories: [],
        tags: [content.metadata.difficulty, content.metadata.format, content.source]
      };
    }
  }

  async generateContentRecommendations(
    userId: string,
    userPreferences: any,
    limit: number = 10
  ): Promise<ContentRecommendation[]> {
    try {
      logger.info('Generating content recommendations:', { userId, limit });

      // Build search query based on user preferences
      const searchQuery: ContentSearchQuery = {
        query: userPreferences.interests?.join(' ') || '',
        filters: {
          difficulty: userPreferences.skillLevel,
          format: userPreferences.preferredFormats?.[0],
          ageRating: userPreferences.ageRating
        },
        size: limit * 2, // Get more results to filter and rank
        includeAggregations: false
      };

      const searchResult = await this.searchContentAdvanced(searchQuery);

      // Convert to recommendations with scoring
      const recommendations: ContentRecommendation[] = searchResult.items.map(content => ({
        content,
        relevanceScore: this.calculateRecommendationScore(content, userPreferences),
        reason: this.generateRecommendationReason(content, userPreferences),
        matchedSkills: this.extractMatchedSkills(content, userPreferences)
      }));

      // Sort by relevance score and limit results
      const sortedRecommendations = recommendations
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      logger.info('Content recommendations generated:', {
        userId,
        count: sortedRecommendations.length,
        avgScore: sortedRecommendations.reduce((sum, rec) => sum + rec.relevanceScore, 0) / sortedRecommendations.length
      });

      return sortedRecommendations;
    } catch (error) {
      logger.error('Error generating content recommendations:', error);
      throw error;
    }
  }

  private calculateRecommendationScore(content: ContentItem, userPreferences: any): number {
    let score = 0.5; // Base score

    // Quality factors (40% weight)
    score += (content.qualityMetrics.effectivenessScore / 100) * 0.2;
    score += (content.qualityMetrics.userRating / 5) * 0.1;
    score += (content.qualityMetrics.completionRate / 100) * 0.1;

    // User preference matching (40% weight)
    if (userPreferences.interests) {
      const contentText = `${content.title} ${content.description} ${content.metadata.topics.join(' ')}`.toLowerCase();
      const matchingInterests = userPreferences.interests.filter((interest: string) =>
        contentText.includes(interest.toLowerCase())
      ).length;
      score += (matchingInterests / userPreferences.interests.length) * 0.2;
    }

    if (userPreferences.skillLevel === content.metadata.difficulty) {
      score += 0.1;
    }

    if (userPreferences.preferredFormats?.includes(content.metadata.format)) {
      score += 0.1;
    }

    // Duration preference (10% weight)
    if (userPreferences.sessionDuration) {
      const durationMatch = Math.abs(content.metadata.duration - userPreferences.sessionDuration) / userPreferences.sessionDuration;
      score += Math.max(0, (1 - durationMatch)) * 0.1;
    }

    // Freshness factor (10% weight)
    const daysSinceCreated = (Date.now() - content.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const freshnessScore = Math.max(0, 1 - (daysSinceCreated / 365)); // Decay over a year
    score += freshnessScore * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private generateRecommendationReason(content: ContentItem, userPreferences: any): string {
    const reasons: string[] = [];

    if (content.qualityMetrics.effectivenessScore > 80) {
      reasons.push('highly effective content');
    }

    if (content.qualityMetrics.userRating > 4.0) {
      reasons.push('highly rated by users');
    }

    if (userPreferences.skillLevel === content.metadata.difficulty) {
      reasons.push('matches your skill level');
    }

    if (userPreferences.interests) {
      const contentText = `${content.title} ${content.description}`.toLowerCase();
      const matchingInterests = userPreferences.interests.filter((interest: string) =>
        contentText.includes(interest.toLowerCase())
      );
      if (matchingInterests.length > 0) {
        reasons.push(`covers your interests: ${matchingInterests.join(', ')}`);
      }
    }

    if (content.source === 'khan_academy') {
      reasons.push('from trusted educational source');
    }

    return reasons.length > 0 ? `Recommended because it's ${reasons.join(' and ')}` : 'Recommended based on your profile';
  }

  private extractMatchedSkills(content: ContentItem, userPreferences: any): string[] {
    const matchedSkills: string[] = [];

    if (userPreferences.interests) {
      const contentText = `${content.title} ${content.description} ${content.metadata.topics.join(' ')}`.toLowerCase();
      const matchingInterests = userPreferences.interests.filter((interest: string) =>
        contentText.includes(interest.toLowerCase())
      );
      matchedSkills.push(...matchingInterests);
    }

    // Add subject as a matched skill if it aligns with user preferences
    if (userPreferences.subjects && userPreferences.subjects.includes(content.metadata.subject)) {
      matchedSkills.push(content.metadata.subject);
    }

    // Add topics that match user skills
    if (userPreferences.skills) {
      const matchingTopics = content.metadata.topics.filter(topic =>
        userPreferences.skills.some((skill: string) =>
          skill.toLowerCase().includes(topic.toLowerCase()) ||
          topic.toLowerCase().includes(skill.toLowerCase())
        )
      );
      matchedSkills.push(...matchingTopics);
    }

    return [...new Set(matchedSkills)]; // Remove duplicates
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}