import { google, youtube_v3 } from 'googleapis';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { 
  ContentItem, 
  ContentMetadata, 
  QualityMetrics,
  ContentSource,
  ContentFormat,
  DifficultyLevel,
  AgeRating
} from '@lusilearn/shared-types';

export interface YouTubeSearchOptions {
  query: string;
  maxResults?: number;
  order?: 'relevance' | 'date' | 'rating' | 'viewCount';
  duration?: 'short' | 'medium' | 'long';
  category?: string;
}

export interface YouTubeVideoDetails {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number; // in seconds
  viewCount: number;
  likeCount: number;
  publishedAt: Date;
  channelTitle: string;
  categoryId: string;
  tags: string[];
}

export class YouTubeService {
  private youtube: youtube_v3.Youtube;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('YouTube API key not configured');
    }
    
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.apiKey
    });
  }

  async searchVideos(options: YouTubeSearchOptions): Promise<YouTubeVideoDetails[]> {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: options.query,
        type: ['video'],
        maxResults: options.maxResults || 20,
        order: options.order || 'relevance',
        videoDuration: options.duration,
        videoCategoryId: options.category,
        safeSearch: 'strict', // Always use safe search for educational content
        relevanceLanguage: 'en'
      });

      if (!searchResponse.data.items) {
        return [];
      }

      // Get detailed video information
      const videoIds = searchResponse.data.items
        .map(item => item.id?.videoId)
        .filter(Boolean) as string[];

      if (videoIds.length === 0) {
        return [];
      }

      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: videoIds
      });

      if (!videosResponse.data.items) {
        return [];
      }

      return videosResponse.data.items.map(video => this.mapYouTubeVideoToDetails(video));
    } catch (error) {
      logger.error('Error searching YouTube videos:', error);
      throw error;
    }
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
    try {
      if (!this.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      const response = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: [videoId]
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      return this.mapYouTubeVideoToDetails(response.data.items[0]);
    } catch (error) {
      logger.error('Error getting YouTube video details:', error);
      throw error;
    }
  }

  async convertToContentItem(videoDetails: YouTubeVideoDetails): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>> {
    try {
      const metadata: ContentMetadata = {
        duration: videoDetails.duration,
        difficulty: this.inferDifficulty(videoDetails),
        subject: this.inferSubject(videoDetails),
        topics: this.extractTopics(videoDetails),
        format: ContentFormat.VIDEO,
        language: 'en',
        learningObjectives: this.extractLearningObjectives(videoDetails)
      };

      const qualityMetrics: QualityMetrics = {
        userRating: this.calculateUserRating(videoDetails),
        completionRate: 0, // Will be updated based on user interactions
        effectivenessScore: this.calculateEffectivenessScore(videoDetails),
        reportCount: 0,
        lastUpdated: new Date()
      };

      return {
        source: ContentSource.YOUTUBE,
        externalId: videoDetails.id,
        url: `https://www.youtube.com/watch?v=${videoDetails.id}`,
        title: videoDetails.title,
        description: videoDetails.description,
        thumbnailUrl: videoDetails.thumbnailUrl,
        metadata,
        qualityMetrics,
        ageRating: this.determineAgeRating(videoDetails),
        isActive: true
      };
    } catch (error) {
      logger.error('Error converting YouTube video to content item:', error);
      throw error;
    }
  }

  private mapYouTubeVideoToDetails(video: youtube_v3.Schema$Video): YouTubeVideoDetails {
    const snippet = video.snippet!;
    const contentDetails = video.contentDetails!;
    const statistics = video.statistics!;

    return {
      id: video.id!,
      title: snippet.title || '',
      description: snippet.description || '',
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
      duration: this.parseDuration(contentDetails.duration || ''),
      viewCount: parseInt(statistics.viewCount || '0'),
      likeCount: parseInt(statistics.likeCount || '0'),
      publishedAt: new Date(snippet.publishedAt || ''),
      channelTitle: snippet.channelTitle || '',
      categoryId: snippet.categoryId || '',
      tags: snippet.tags || []
    };
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration format (PT4M13S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private inferDifficulty(video: YouTubeVideoDetails): DifficultyLevel {
    const title = video.title.toLowerCase();
    const description = video.description.toLowerCase();
    const text = `${title} ${description}`;

    // Simple keyword-based difficulty inference
    if (text.includes('beginner') || text.includes('intro') || text.includes('basic') || text.includes('101')) {
      return DifficultyLevel.BEGINNER;
    }
    if (text.includes('advanced') || text.includes('expert') || text.includes('master') || text.includes('professional')) {
      return DifficultyLevel.ADVANCED;
    }
    if (text.includes('intermediate') || text.includes('medium')) {
      return DifficultyLevel.INTERMEDIATE;
    }

    // Default based on duration and complexity indicators
    if (video.duration < 600) { // Less than 10 minutes
      return DifficultyLevel.BEGINNER;
    }
    if (video.duration > 3600) { // More than 1 hour
      return DifficultyLevel.ADVANCED;
    }

    return DifficultyLevel.INTERMEDIATE;
  }

  private inferSubject(video: YouTubeVideoDetails): string {
    const title = video.title.toLowerCase();
    const description = video.description.toLowerCase();
    const text = `${title} ${description}`;

    // Subject inference based on keywords
    const subjects = {
      'mathematics': ['math', 'algebra', 'calculus', 'geometry', 'statistics', 'trigonometry'],
      'programming': ['programming', 'coding', 'javascript', 'python', 'java', 'react', 'node'],
      'science': ['physics', 'chemistry', 'biology', 'science'],
      'computer-science': ['computer science', 'algorithms', 'data structures', 'software'],
      'web-development': ['web development', 'html', 'css', 'frontend', 'backend'],
      'data-science': ['data science', 'machine learning', 'ai', 'artificial intelligence'],
      'general': []
    };

    for (const [subject, keywords] of Object.entries(subjects)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return subject;
      }
    }

    return 'general';
  }

  private extractTopics(video: YouTubeVideoDetails): string[] {
    const topics: string[] = [];
    
    // Extract from tags
    if (video.tags) {
      topics.push(...video.tags.slice(0, 5)); // Limit to first 5 tags
    }

    // Extract from title (simple keyword extraction)
    const titleWords = video.title.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);
    
    topics.push(...titleWords);

    return [...new Set(topics)]; // Remove duplicates
  }

  private extractLearningObjectives(video: YouTubeVideoDetails): string[] {
    // Simple extraction based on common patterns in educational videos
    const objectives: string[] = [];
    const description = video.description.toLowerCase();

    // Look for common objective patterns
    const objectivePatterns = [
      /learn (?:how to |about )?([^.!?]+)/g,
      /understand ([^.!?]+)/g,
      /master ([^.!?]+)/g,
      /explore ([^.!?]+)/g
    ];

    objectivePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(description)) !== null && objectives.length < 3) {
        objectives.push(match[1].trim());
      }
    });

    // Fallback: use subject and title
    if (objectives.length === 0) {
      objectives.push(`Learn ${this.inferSubject({ ...video, description: video.title })}`);
    }

    return objectives;
  }

  private calculateUserRating(video: YouTubeVideoDetails): number {
    // Calculate rating based on like ratio and view count
    const likeRatio = video.likeCount / Math.max(video.viewCount, 1);
    const viewScore = Math.min(video.viewCount / 10000, 1); // Normalize view count
    
    // Combine metrics (like ratio weighted more heavily)
    const rating = (likeRatio * 0.7 + viewScore * 0.3) * 5;
    
    return Math.max(1, Math.min(5, rating));
  }

  private calculateEffectivenessScore(video: YouTubeVideoDetails): number {
    // Calculate effectiveness based on various factors
    let score = 50; // Base score

    // Duration factor (optimal range: 5-20 minutes for educational content)
    const optimalDuration = video.duration >= 300 && video.duration <= 1200;
    if (optimalDuration) score += 20;

    // Engagement factor (likes per view)
    const engagementRatio = video.likeCount / Math.max(video.viewCount, 1);
    score += Math.min(engagementRatio * 1000, 20);

    // Recency factor (newer content gets slight boost)
    const daysSincePublished = (Date.now() - video.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublished < 365) {
      score += Math.max(0, 10 - daysSincePublished / 36.5);
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineAgeRating(video: YouTubeVideoDetails): AgeRating {
    // Since we use safe search, most content should be appropriate
    // Additional filtering can be added based on channel, keywords, etc.
    const title = video.title.toLowerCase();
    const description = video.description.toLowerCase();

    // Check for adult-oriented keywords
    const adultKeywords = ['adult', 'mature', 'advanced professional', 'workplace'];
    if (adultKeywords.some(keyword => title.includes(keyword) || description.includes(keyword))) {
      return AgeRating.ADULT;
    }

    // Check for teen-oriented content
    const teenKeywords = ['high school', 'college prep', 'sat', 'act', 'university'];
    if (teenKeywords.some(keyword => title.includes(keyword) || description.includes(keyword))) {
      return AgeRating.TEEN;
    }

    return AgeRating.ALL_AGES;
  }
}