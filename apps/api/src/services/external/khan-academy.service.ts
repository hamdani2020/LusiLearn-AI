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

export interface KhanAcademyTopic {
  id: string;
  title: string;
  description: string;
  kind: string;
  slug: string;
  url: string;
  children?: KhanAcademyTopic[];
}

export interface KhanAcademyExercise {
  id: string;
  title: string;
  description: string;
  url: string;
  kind: string;
  slug: string;
  prerequisites: string[];
  tags: string[];
  difficulty: number; // 1-5 scale
}

export interface KhanAcademyVideo {
  id: string;
  title: string;
  description: string;
  url: string;
  youtubeId: string;
  duration: number;
  thumbnailUrl: string;
  slug: string;
  tags: string[];
}

export interface KhanAcademyArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  content: string;
  slug: string;
  tags: string[];
}

export class KhanAcademyService {
  private baseUrl = 'https://www.khanacademy.org/api/v1';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.KHAN_ACADEMY_API_KEY || '';
    // Note: Khan Academy API doesn't require authentication for public content
    // but having an API key can provide higher rate limits
  }

  async getTopicTree(): Promise<KhanAcademyTopic> {
    try {
      const response = await axios.get(`${this.baseUrl}/topictree`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Khan Academy topic tree:', error);
      throw error;
    }
  }

  async searchContent(query: string, kind?: string): Promise<any[]> {
    try {
      const params: any = { q: query };
      if (kind) params.kind = kind;

      const response = await axios.get(`${this.baseUrl}/search`, { params });
      return response.data.results || [];
    } catch (error) {
      logger.error('Error searching Khan Academy content:', error);
      throw error;
    }
  }

  async getExercise(exerciseId: string): Promise<KhanAcademyExercise | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/exercises/${exerciseId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Khan Academy exercise:', error);
      return null;
    }
  }

  async getVideo(videoId: string): Promise<KhanAcademyVideo | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/videos/${videoId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Khan Academy video:', error);
      return null;
    }
  }

  async getArticle(articleId: string): Promise<KhanAcademyArticle | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/articles/${articleId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching Khan Academy article:', error);
      return null;
    }
  }

  async getContentBySubject(subject: string, limit: number = 20): Promise<any[]> {
    try {
      // Map common subjects to Khan Academy topic slugs
      const subjectMapping: { [key: string]: string } = {
        'mathematics': 'math',
        'math': 'math',
        'algebra': 'algebra',
        'geometry': 'geometry',
        'calculus': 'calculus',
        'statistics': 'statistics-probability',
        'science': 'science',
        'physics': 'physics',
        'chemistry': 'chemistry',
        'biology': 'biology',
        'programming': 'computing',
        'computer-science': 'computing',
        'economics': 'economics-finance-domain',
        'history': 'humanities'
      };

      const topicSlug = subjectMapping[subject.toLowerCase()] || subject;
      
      // Get topic content
      const response = await axios.get(`${this.baseUrl}/topic/${topicSlug}`);
      const topic = response.data;

      // Extract content items (videos, exercises, articles)
      const contentItems: any[] = [];
      
      if (topic.children) {
        for (const child of topic.children.slice(0, limit)) {
          if (child.kind === 'Video' || child.kind === 'Exercise' || child.kind === 'Article') {
            contentItems.push(child);
          }
        }
      }

      return contentItems;
    } catch (error) {
      logger.error('Error fetching Khan Academy content by subject:', error);
      return [];
    }
  }

  async convertVideoToContentItem(video: KhanAcademyVideo): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>> {
    try {
      const metadata: ContentMetadata = {
        duration: video.duration,
        difficulty: this.inferDifficultyFromTags(video.tags),
        subject: this.inferSubjectFromTags(video.tags),
        topics: video.tags.slice(0, 5),
        format: ContentFormat.VIDEO,
        language: 'en',
        learningObjectives: this.extractLearningObjectives(video.title, video.description)
      };

      const qualityMetrics: QualityMetrics = {
        userRating: 4.5, // Khan Academy content is generally high quality
        completionRate: 0, // Will be updated based on user interactions
        effectivenessScore: 85, // High base score for Khan Academy content
        reportCount: 0,
        lastUpdated: new Date()
      };

      return {
        source: ContentSource.KHAN_ACADEMY,
        externalId: video.id,
        url: video.url,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        metadata,
        qualityMetrics,
        ageRating: this.determineAgeRating(video.tags),
        isActive: true
      };
    } catch (error) {
      logger.error('Error converting Khan Academy video to content item:', error);
      throw error;
    }
  }

  async convertExerciseToContentItem(exercise: KhanAcademyExercise): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>> {
    try {
      const metadata: ContentMetadata = {
        duration: 900, // Estimate 15 minutes for exercises
        difficulty: this.mapKhanDifficultyToEnum(exercise.difficulty),
        subject: this.inferSubjectFromTags(exercise.tags),
        topics: exercise.tags.slice(0, 5),
        format: ContentFormat.INTERACTIVE,
        language: 'en',
        prerequisites: exercise.prerequisites,
        learningObjectives: this.extractLearningObjectives(exercise.title, exercise.description)
      };

      const qualityMetrics: QualityMetrics = {
        userRating: 4.3, // Khan Academy exercises are well-designed
        completionRate: 0,
        effectivenessScore: 80,
        reportCount: 0,
        lastUpdated: new Date()
      };

      return {
        source: ContentSource.KHAN_ACADEMY,
        externalId: exercise.id,
        url: exercise.url,
        title: exercise.title,
        description: exercise.description,
        metadata,
        qualityMetrics,
        ageRating: this.determineAgeRating(exercise.tags),
        isActive: true
      };
    } catch (error) {
      logger.error('Error converting Khan Academy exercise to content item:', error);
      throw error;
    }
  }

  async convertArticleToContentItem(article: KhanAcademyArticle): Promise<Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>> {
    try {
      const readingTime = this.estimateReadingTime(article.content);
      
      const metadata: ContentMetadata = {
        duration: readingTime,
        difficulty: this.inferDifficultyFromTags(article.tags),
        subject: this.inferSubjectFromTags(article.tags),
        topics: article.tags.slice(0, 5),
        format: ContentFormat.ARTICLE,
        language: 'en',
        learningObjectives: this.extractLearningObjectives(article.title, article.description)
      };

      const qualityMetrics: QualityMetrics = {
        userRating: 4.4,
        completionRate: 0,
        effectivenessScore: 82,
        reportCount: 0,
        lastUpdated: new Date()
      };

      return {
        source: ContentSource.KHAN_ACADEMY,
        externalId: article.id,
        url: article.url,
        title: article.title,
        description: article.description,
        metadata,
        qualityMetrics,
        ageRating: this.determineAgeRating(article.tags),
        isActive: true
      };
    } catch (error) {
      logger.error('Error converting Khan Academy article to content item:', error);
      throw error;
    }
  }

  private inferDifficultyFromTags(tags: string[]): DifficultyLevel {
    const tagString = tags.join(' ').toLowerCase();

    if (tagString.includes('elementary') || tagString.includes('basic') || tagString.includes('intro')) {
      return DifficultyLevel.BEGINNER;
    }
    if (tagString.includes('advanced') || tagString.includes('calculus') || tagString.includes('college')) {
      return DifficultyLevel.ADVANCED;
    }
    if (tagString.includes('middle') || tagString.includes('intermediate') || tagString.includes('algebra')) {
      return DifficultyLevel.INTERMEDIATE;
    }

    return DifficultyLevel.BEGINNER; // Khan Academy skews toward foundational content
  }

  private inferSubjectFromTags(tags: string[]): string {
    const tagString = tags.join(' ').toLowerCase();

    const subjects = {
      'mathematics': ['math', 'algebra', 'geometry', 'calculus', 'statistics', 'arithmetic'],
      'science': ['physics', 'chemistry', 'biology', 'science'],
      'programming': ['programming', 'computer', 'coding'],
      'economics': ['economics', 'finance'],
      'history': ['history', 'humanities'],
      'art': ['art', 'music']
    };

    for (const [subject, keywords] of Object.entries(subjects)) {
      if (keywords.some(keyword => tagString.includes(keyword))) {
        return subject;
      }
    }

    return 'general';
  }

  private mapKhanDifficultyToEnum(difficulty: number): DifficultyLevel {
    if (difficulty <= 2) return DifficultyLevel.BEGINNER;
    if (difficulty <= 3) return DifficultyLevel.INTERMEDIATE;
    return DifficultyLevel.ADVANCED;
  }

  private extractLearningObjectives(title: string, description: string): string[] {
    const objectives: string[] = [];
    const text = `${title} ${description}`.toLowerCase();

    // Common patterns in Khan Academy content
    const patterns = [
      /learn (?:about |how to )?([^.!?]+)/g,
      /understand ([^.!?]+)/g,
      /practice ([^.!?]+)/g,
      /solve ([^.!?]+)/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null && objectives.length < 3) {
        objectives.push(match[1].trim());
      }
    });

    // Fallback
    if (objectives.length === 0) {
      objectives.push(`Learn ${title.toLowerCase()}`);
    }

    return objectives;
  }

  private determineAgeRating(tags: string[]): AgeRating {
    const tagString = tags.join(' ').toLowerCase();

    if (tagString.includes('college') || tagString.includes('university') || tagString.includes('advanced')) {
      return AgeRating.ADULT;
    }
    if (tagString.includes('high school') || tagString.includes('middle school')) {
      return AgeRating.TEEN;
    }

    return AgeRating.ALL_AGES;
  }

  private estimateReadingTime(content: string): number {
    // Average reading speed: 200 words per minute
    const wordCount = content.split(/\s+/).length;
    const readingTimeMinutes = wordCount / 200;
    return Math.max(60, readingTimeMinutes * 60); // Minimum 1 minute
  }
}