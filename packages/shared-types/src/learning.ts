import { z } from 'zod';
import { BaseEntity, DifficultyLevel, IdSchema } from './common';

// Learning path and progress types
export interface LearningObjective {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number; // in minutes
  prerequisites: string[];
  skills: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  completionCriteria: string[];
  isCompleted: boolean;
  completedAt?: Date;
}

export interface PathAdaptation {
  timestamp: Date;
  reason: string;
  changes: {
    addedObjectives?: string[];
    removedObjectives?: string[];
    difficultyAdjustment?: DifficultyLevel;
  };
}

export interface LearningPath extends BaseEntity {
  userId: string;
  subject: string;
  currentLevel: DifficultyLevel;
  objectives: LearningObjective[];
  milestones: Milestone[];
  progress: {
    completedObjectives: string[];
    currentMilestone: string;
    overallProgress: number; // 0-100
    estimatedCompletion: Date;
  };
  adaptationHistory: PathAdaptation[];
}

export interface LearningGoal {
  objective: string;
  timeline: string;
  priority: 'low' | 'medium' | 'high';
}

export interface UserInteraction {
  type: 'click' | 'scroll' | 'pause' | 'replay' | 'skip';
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AssessmentResult {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  timeSpent: number;
  attempts: number;
}

export interface EngagementMetrics {
  attentionScore: number; // 0-100
  interactionCount: number;
  pauseCount: number;
  replayCount: number;
  completionRate: number; // 0-100
}

export interface LearningSession extends BaseEntity {
  userId: string;
  pathId: string;
  contentItems: string[];
  duration: number; // in seconds
  interactions: UserInteraction[];
  assessmentResults: AssessmentResult[];
  comprehensionScore: number; // 0-100
  engagementMetrics: EngagementMetrics;
}

export interface PerformanceData {
  sessionId: string;
  comprehensionScore: number;
  timeSpent: number;
  strugglingConcepts: string[];
  masteredConcepts: string[];
}

export interface LearningInsights {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  predictedPerformance: number;
  suggestedDifficulty: DifficultyLevel;
}

// Validation schemas
export const LearningObjectiveSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: z.string(),
  estimatedDuration: z.number().min(1),
  prerequisites: z.array(z.string()),
  skills: z.array(z.string())
});

export const MilestoneSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  completionCriteria: z.array(z.string()),
  isCompleted: z.boolean(),
  completedAt: z.date().optional()
});

export const PathAdaptationSchema = z.object({
  timestamp: z.date(),
  reason: z.string(),
  changes: z.object({
    addedObjectives: z.array(z.string()).optional(),
    removedObjectives: z.array(z.string()).optional(),
    difficultyAdjustment: z.nativeEnum(DifficultyLevel).optional()
  })
});

export const LearningPathSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  subject: z.string(),
  currentLevel: z.nativeEnum(DifficultyLevel),
  objectives: z.array(LearningObjectiveSchema),
  milestones: z.array(MilestoneSchema),
  progress: z.object({
    completedObjectives: z.array(z.string()),
    currentMilestone: z.string(),
    overallProgress: z.number().min(0).max(100),
    estimatedCompletion: z.date()
  }),
  adaptationHistory: z.array(PathAdaptationSchema),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const UserInteractionSchema = z.object({
  type: z.enum(['click', 'scroll', 'pause', 'replay', 'skip']),
  timestamp: z.date(),
  duration: z.number().optional(),
  metadata: z.record(z.any()).optional()
});

export const AssessmentResultSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  isCorrect: z.boolean(),
  timeSpent: z.number(),
  attempts: z.number()
});

export const EngagementMetricsSchema = z.object({
  attentionScore: z.number().min(0).max(100),
  interactionCount: z.number(),
  pauseCount: z.number(),
  replayCount: z.number(),
  completionRate: z.number().min(0).max(100)
});

export const LearningSessionSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  pathId: IdSchema,
  contentItems: z.array(z.string()),
  duration: z.number().min(0),
  interactions: z.array(UserInteractionSchema),
  assessmentResults: z.array(AssessmentResultSchema),
  comprehensionScore: z.number().min(0).max(100),
  engagementMetrics: EngagementMetricsSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

export const LearningGoalSchema = z.object({
  objective: z.string(),
  timeline: z.string(),
  priority: z.enum(['low', 'medium', 'high'])
});

export const CreateLearningPathSchema = z.object({
  subject: z.string(),
  goals: z.array(LearningGoalSchema)
});