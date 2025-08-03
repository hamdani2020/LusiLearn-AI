import axios from 'axios';
import { logger } from '../utils/logger';
import { 
  ContentItem, 
  AgeRating, 
  DifficultyLevel,
  ValidationResult 
} from '@lusilearn/shared-types';

export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number; // 0-1 scale
  flags: string[];
  suggestedAgeRating: AgeRating;
  reasons: string[];
}

export interface ContentReport {
  id: string;
  contentId: string;
  userId: string;
  reason: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: string;
}

export interface QualityAssessment {
  overallScore: number; // 0-100
  factors: {
    contentClarity: number;
    educationalValue: number;
    technicalQuality: number;
    ageAppropriateness: number;
    accuracyScore: number;
  };
  recommendations: string[];
}

export class ContentModerationService {
  private openaiApiKey: string;
  private moderationEndpoint = 'https://api.openai.com/v1/moderations';

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    if (!this.openaiApiKey) {
      logger.warn('OpenAI API key not configured for content moderation');
    }
  }

  async moderateContent(content: ContentItem): Promise<ModerationResult> {
    try {
      logger.info('Starting content moderation:', { contentId: content.id });

      // Combine title and description for moderation
      const textToModerate = `${content.title}\n\n${content.description}`;

      // Run multiple moderation checks
      const [
        aiModerationResult,
        keywordModerationResult,
        ageAppropriatenessResult
      ] = await Promise.allSettled([
        this.runAIModerationCheck(textToModerate),
        this.runKeywordModerationCheck(textToModerate),
        this.assessAgeAppropriateness(content)
      ]);

      // Combine results
      const result: ModerationResult = {
        isAppropriate: true,
        confidence: 0.8,
        flags: [],
        suggestedAgeRating: AgeRating.ALL_AGES, // Default to most permissive
        reasons: []
      };

      // Process AI moderation result
      if (aiModerationResult.status === 'fulfilled') {
        const aiResult = aiModerationResult.value;
        if (!aiResult.isAppropriate) {
          result.isAppropriate = false;
          result.flags.push(...aiResult.flags);
          result.reasons.push(...aiResult.reasons);
          result.confidence = Math.min(result.confidence, aiResult.confidence);
        }
      } else {
        logger.warn('AI moderation failed:', aiModerationResult.reason);
        result.isAppropriate = false;
        result.confidence = 0.3;
        result.flags.push('moderation_error');
        result.reasons.push('Content moderation service encountered an error');
      }

      // Process keyword moderation result
      if (keywordModerationResult.status === 'fulfilled') {
        const keywordResult = keywordModerationResult.value;
        if (!keywordResult.isAppropriate) {
          result.isAppropriate = false;
          result.flags.push(...keywordResult.flags);
          result.reasons.push(...keywordResult.reasons);
        }
      }

      // Process age appropriateness result
      if (ageAppropriatenessResult.status === 'fulfilled') {
        const ageResult = ageAppropriatenessResult.value;
        
        // Use the more restrictive age rating between AI result and age assessment
        if (aiModerationResult.status === 'fulfilled') {
          const aiResult = aiModerationResult.value;
          const ageRatingOrder = {
            [AgeRating.ALL_AGES]: 0,
            [AgeRating.TEEN]: 1,
            [AgeRating.ADULT]: 2
          };
          
          const aiRatingLevel = ageRatingOrder[aiResult.suggestedAgeRating];
          const ageRatingLevel = ageRatingOrder[ageResult.suggestedAgeRating];
          
          result.suggestedAgeRating = aiRatingLevel >= ageRatingLevel ? 
            aiResult.suggestedAgeRating : ageResult.suggestedAgeRating;
        } else {
          result.suggestedAgeRating = ageResult.suggestedAgeRating;
        }
        
        if (result.suggestedAgeRating !== content.ageRating) {
          result.flags.push('age_rating_mismatch');
          result.reasons.push(`Suggested age rating: ${result.suggestedAgeRating}, current: ${content.ageRating}`);
        }
      }

      logger.info('Content moderation completed:', { 
        contentId: content.id, 
        isAppropriate: result.isAppropriate,
        confidence: result.confidence,
        flags: result.flags
      });

      return result;
    } catch (error) {
      logger.error('Error during content moderation:', error);
      
      // Return conservative result on error
      return {
        isAppropriate: false,
        confidence: 0.3,
        flags: ['moderation_error'],
        suggestedAgeRating: AgeRating.ADULT,
        reasons: ['Content moderation service encountered an error']
      };
    }
  }

  async assessContentQuality(content: ContentItem): Promise<QualityAssessment> {
    try {
      logger.info('Assessing content quality:', { contentId: content.id });

      const assessment: QualityAssessment = {
        overallScore: 0,
        factors: {
          contentClarity: 0,
          educationalValue: 0,
          technicalQuality: 0,
          ageAppropriateness: 0,
          accuracyScore: 0
        },
        recommendations: []
      };

      // Assess content clarity
      assessment.factors.contentClarity = this.assessContentClarity(content);
      
      // Assess educational value
      assessment.factors.educationalValue = this.assessEducationalValue(content);
      
      // Assess technical quality
      assessment.factors.technicalQuality = this.assessTechnicalQuality(content);
      
      // Assess age appropriateness
      assessment.factors.ageAppropriateness = this.assessAgeAppropriatenessScore(content);
      
      // Assess accuracy (basic heuristics)
      assessment.factors.accuracyScore = this.assessAccuracy(content);

      // Calculate overall score (weighted average)
      assessment.overallScore = (
        assessment.factors.contentClarity * 0.2 +
        assessment.factors.educationalValue * 0.3 +
        assessment.factors.technicalQuality * 0.2 +
        assessment.factors.ageAppropriateness * 0.15 +
        assessment.factors.accuracyScore * 0.15
      );

      // Generate recommendations
      assessment.recommendations = this.generateQualityRecommendations(assessment.factors);

      logger.info('Content quality assessment completed:', { 
        contentId: content.id, 
        overallScore: assessment.overallScore 
      });

      return assessment;
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
      logger.info('Filtering content for user:', { 
        contentCount: content.length, 
        userAgeRange 
      });

      const filteredContent = content.filter(item => {
        // Age-based filtering
        if (!this.isAgeAppropriate(item, userAgeRange)) {
          return false;
        }

        // Parental controls filtering
        if (parentalControls && !this.passesParentalControls(item, parentalControls)) {
          return false;
        }

        // Quality threshold filtering
        if (item.qualityMetrics.effectivenessScore < 30) {
          return false;
        }

        // Report count filtering
        if (item.qualityMetrics.reportCount > 10) {
          return false;
        }

        return true;
      });

      logger.info('Content filtering completed:', { 
        originalCount: content.length,
        filteredCount: filteredContent.length
      });

      return filteredContent;
    } catch (error) {
      logger.error('Error filtering content:', error);
      throw error;
    }
  }

  private async runAIModerationCheck(text: string): Promise<ModerationResult> {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await axios.post(
        this.moderationEndpoint,
        { input: text },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const moderationResult = response.data.results[0];
      const flags: string[] = [];
      const reasons: string[] = [];

      // Check each category
      if (moderationResult.categories.hate) {
        flags.push('hate_speech');
        reasons.push('Content contains hate speech');
      }
      if (moderationResult.categories.harassment) {
        flags.push('harassment');
        reasons.push('Content contains harassment');
      }
      if (moderationResult.categories.violence) {
        flags.push('violence');
        reasons.push('Content contains violent content');
      }
      if (moderationResult.categories.sexual) {
        flags.push('sexual_content');
        reasons.push('Content contains sexual material');
      }
      if (moderationResult.categories['self-harm']) {
        flags.push('self_harm');
        reasons.push('Content contains self-harm references');
      }

      return {
        isAppropriate: !moderationResult.flagged,
        confidence: 0.9,
        flags,
        suggestedAgeRating: moderationResult.flagged ? AgeRating.ADULT : AgeRating.ALL_AGES,
        reasons
      };
    } catch (error) {
      logger.error('AI moderation check failed:', error);
      throw error;
    }
  }

  private async runKeywordModerationCheck(text: string): Promise<ModerationResult> {
    const inappropriateKeywords = [
      'explicit', 'adult', 'mature', 'violence', 'inappropriate',
      'nsfw', 'graphic', 'disturbing', 'controversial'
    ];

    const educationalKeywords = [
      'learn', 'tutorial', 'education', 'teach', 'explain',
      'guide', 'lesson', 'course', 'study', 'academic'
    ];

    const lowerText = text.toLowerCase();
    const flags: string[] = [];
    const reasons: string[] = [];

    // Check for inappropriate keywords
    for (const keyword of inappropriateKeywords) {
      if (lowerText.includes(keyword)) {
        flags.push('inappropriate_keyword');
        reasons.push(`Contains potentially inappropriate keyword: ${keyword}`);
      }
    }

    // Boost confidence if educational keywords are present
    const educationalScore = educationalKeywords.filter(keyword => 
      lowerText.includes(keyword)
    ).length / educationalKeywords.length;

    return {
      isAppropriate: flags.length === 0,
      confidence: 0.7 + (educationalScore * 0.2),
      flags,
      suggestedAgeRating: flags.length > 0 ? AgeRating.ADULT : AgeRating.ALL_AGES,
      reasons
    };
  }

  private async assessAgeAppropriateness(content: ContentItem): Promise<{ suggestedAgeRating: AgeRating }> {
    const title = content.title.toLowerCase();
    const description = content.description.toLowerCase();
    const text = `${title} ${description}`;

    // Keywords that suggest different age ratings
    const adultKeywords = ['advanced', 'professional', 'enterprise', 'complex', 'sophisticated'];
    const teenKeywords = ['high school', 'college prep', 'intermediate', 'sat', 'act'];
    const childKeywords = ['elementary', 'basic', 'beginner', 'kids', 'children', 'simple'];

    const adultScore = adultKeywords.filter(keyword => text.includes(keyword)).length;
    const teenScore = teenKeywords.filter(keyword => text.includes(keyword)).length;
    const childScore = childKeywords.filter(keyword => text.includes(keyword)).length;

    let suggestedAgeRating: AgeRating;

    if (adultScore > teenScore && adultScore > childScore) {
      suggestedAgeRating = AgeRating.ADULT;
    } else if (teenScore > childScore) {
      suggestedAgeRating = AgeRating.TEEN;
    } else {
      suggestedAgeRating = AgeRating.ALL_AGES;
    }

    // Consider content difficulty
    if (content.metadata.difficulty === DifficultyLevel.EXPERT) {
      suggestedAgeRating = AgeRating.ADULT;
    } else if (content.metadata.difficulty === DifficultyLevel.ADVANCED) {
      suggestedAgeRating = suggestedAgeRating === AgeRating.ALL_AGES ? AgeRating.TEEN : suggestedAgeRating;
    }

    return { suggestedAgeRating };
  }

  private assessContentClarity(content: ContentItem): number {
    let score = 30; // Lower base score

    // Title clarity
    if (content.title.length > 10 && content.title.length < 100) {
      score += 20;
    } else if (content.title.length <= 5) {
      score -= 10; // Penalty for very short titles
    }

    // Description completeness
    if (content.description.length > 50) {
      score += 20;
    } else if (content.description.length <= 10) {
      score -= 10; // Penalty for very short descriptions
    }

    // Learning objectives presence
    if (content.metadata.learningObjectives && content.metadata.learningObjectives.length > 0) {
      score += 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  private assessEducationalValue(content: ContentItem): number {
    let score = 20; // Lower base score

    // Subject classification
    if (content.metadata.subject && content.metadata.subject !== 'general') {
      score += 25;
    }

    // Learning objectives
    if (content.metadata.learningObjectives && content.metadata.learningObjectives.length > 0) {
      score += 35;
    }

    // Topics coverage
    if (content.metadata.topics && content.metadata.topics.length > 0) {
      score += 20;
    }

    return Math.min(100, score);
  }

  private assessTechnicalQuality(content: ContentItem): number {
    let score = 60; // Base score

    // Duration appropriateness
    const duration = content.metadata.duration;
    if (duration >= 300 && duration <= 3600) { // 5 minutes to 1 hour
      score += 20;
    } else if (duration < 60 || duration > 7200) { // Too short or too long
      score -= 20;
    }

    // Thumbnail presence
    if (content.thumbnailUrl) {
      score += 10;
    }

    // Metadata completeness
    if (content.metadata.language && content.metadata.format) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private assessAgeAppropriatenessScore(content: ContentItem): number {
    // This is a simplified assessment
    // In a real system, this would be more sophisticated
    
    const title = content.title.toLowerCase();
    const description = content.description.toLowerCase();
    
    // Check for age-inappropriate content indicators
    const inappropriateIndicators = ['explicit', 'adult', 'mature', 'violence'];
    const hasInappropriateContent = inappropriateIndicators.some(indicator => 
      title.includes(indicator) || description.includes(indicator)
    );

    if (hasInappropriateContent) {
      return 20; // Low score for inappropriate content
    }

    // Check for educational indicators
    const educationalIndicators = ['learn', 'tutorial', 'education', 'teach'];
    const hasEducationalContent = educationalIndicators.some(indicator => 
      title.includes(indicator) || description.includes(indicator)
    );

    return hasEducationalContent ? 90 : 70;
  }

  private assessAccuracy(content: ContentItem): number {
    let score = 70; // Base score (neutral)

    // Source reliability
    const sourceReliability = {
      'khan_academy': 95,
      'coursera': 90,
      'youtube': 60,
      'github': 75,
      'internal': 85
    };

    const reliability = sourceReliability[content.source as keyof typeof sourceReliability] || 50;
    score = (score + reliability) / 2;

    // User feedback
    if (content.qualityMetrics.userRating > 4.0) {
      score += 10;
    } else if (content.qualityMetrics.userRating < 2.0) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private generateQualityRecommendations(factors: QualityAssessment['factors']): string[] {
    const recommendations: string[] = [];

    if (factors.contentClarity < 60) {
      recommendations.push('Improve content title and description clarity');
    }

    if (factors.educationalValue < 60) {
      recommendations.push('Add clear learning objectives and better subject classification');
    }

    if (factors.technicalQuality < 60) {
      recommendations.push('Improve technical aspects like duration and metadata completeness');
    }

    if (factors.ageAppropriateness < 70) {
      recommendations.push('Review content for age appropriateness');
    }

    if (factors.accuracyScore < 60) {
      recommendations.push('Verify content accuracy and reliability');
    }

    return recommendations;
  }

  private isAgeAppropriate(content: ContentItem, userAgeRange: string): boolean {
    const ageRatingOrder = {
      [AgeRating.ALL_AGES]: 0,
      [AgeRating.TEEN]: 1,
      [AgeRating.ADULT]: 2
    };

    const userAgeOrder = {
      'child': 0,
      'teen': 1,
      'adult': 2
    };

    const contentRatingLevel = ageRatingOrder[content.ageRating];
    const userAgeLevel = userAgeOrder[userAgeRange as keyof typeof userAgeOrder];

    // If user age is undefined, default to adult (most permissive)
    if (userAgeLevel === undefined) {
      return true;
    }

    return contentRatingLevel <= userAgeLevel;
  }

  private passesParentalControls(content: ContentItem, parentalControls: any): boolean {
    // Check content filtering level
    if (parentalControls.contentFiltering === 'strict') {
      return content.ageRating === AgeRating.ALL_AGES && 
             content.qualityMetrics.reportCount === 0;
    }

    if (parentalControls.contentFiltering === 'moderate') {
      return content.ageRating !== AgeRating.ADULT && 
             content.qualityMetrics.reportCount < 3;
    }

    // 'relaxed' or no filtering
    return content.qualityMetrics.reportCount < 10;
  }
}