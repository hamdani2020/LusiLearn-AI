import { z } from 'zod';
import { BaseEntity, ContentSource, ContentFormat, AgeRating, DifficultyLevel } from './common';

// Content-related types and interfaces
export interface ContentMetadata {
  duration: number; // in seconds
  difficulty: DifficultyLevel;
  subject: string;
  topics: string[];
  format: ContentFormat;
  language: string;
  prerequisites?: string[];
  learningObjectives: string[];
}

export interface QualityMetrics {
  userRating: number; // 1-5 scale
  completionRate: number; // 0-100
  effectivenessScore: number; // 0-100
  reportCount: number;
  lastUpdated: Date;
}

export interface ContentItem extends BaseEntity {
  source: ContentSource;
  externalId: string;
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  metadata: ContentMetadata;
  qualityMetrics: QualityMetrics;
  ageRating: AgeRating;
  embeddings?: number[];
  isActive: boolean;
}

export interface ContentQuery {
  query: string;
  subject?: string;
  difficulty?: DifficultyLevel;
  format?: ContentFormat;
  ageRating?: AgeRating;
  duration?: {
    min?: number;
    max?: number;
  };
  page?: number;
  limit?: number;
}

export interface ContentRecommendation {
  contentId: string;
  score: number; // 0-1 relevance score
  reason: string;
  metadata: {
    difficulty: DifficultyLevel;
    estimatedTime: number;
    format: ContentFormat;
  };
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  ageAppropriate: boolean;
  qualityScore: number;
}

export interface LearningContext {
  currentTopic: string;
  userSkillLevel: DifficultyLevel;
  sessionGoals: string[];
  timeConstraints: number; // available minutes
  preferredFormats: ContentFormat[];
}

// Validation schemas
export const ContentMetadataSchema = z.object({
  duration: z.number().min(0),
  difficulty: z.nativeEnum(DifficultyLevel),
  subject: z.string(),
  topics: z.array(z.string()),
  format: z.nativeEnum(ContentFormat),
  language: z.string(),
  prerequisites: z.array(z.string()).optional(),
  learningObjectives: z.array(z.string())
});

export const QualityMetricsSchema = z.object({
  userRating: z.number().min(1).max(5),
  completionRate: z.number().min(0).max(100),
  effectivenessScore: z.number().min(0).max(100),
  reportCount: z.number().min(0),
  lastUpdated: z.date()
});

export const ContentItemSchema = z.object({
  id: z.string(),
  source: z.nativeEnum(ContentSource),
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().url().optional(),
  metadata: ContentMetadataSchema,
  qualityMetrics: QualityMetricsSchema,
  ageRating: z.nativeEnum(AgeRating),
  embeddings: z.array(z.number()).optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ContentQuerySchema = z.object({
  query: z.string(),
  subject: z.string().optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  format: z.nativeEnum(ContentFormat).optional(),
  ageRating: z.nativeEnum(AgeRating).optional(),
  duration: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional()
});

export const ContentRecommendationSchema = z.object({
  contentId: z.string(),
  score: z.number().min(0).max(1),
  reason: z.string(),
  metadata: z.object({
    difficulty: z.nativeEnum(DifficultyLevel),
    estimatedTime: z.number(),
    format: z.nativeEnum(ContentFormat)
  })
});

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.string()),
  ageAppropriate: z.boolean(),
  qualityScore: z.number().min(0).max(100)
});

export const LearningContextSchema = z.object({
  currentTopic: z.string(),
  userSkillLevel: z.nativeEnum(DifficultyLevel),
  sessionGoals: z.array(z.string()),
  timeConstraints: z.number().min(0),
  preferredFormats: z.array(z.nativeEnum(ContentFormat))
});