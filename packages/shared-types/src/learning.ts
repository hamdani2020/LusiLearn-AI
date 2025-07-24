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
export const LearningGoalSchema = z.object({
  objective: z.string(),
  timeline: z.string(),
  priority: z.enum(['low', 'medium', 'high'])
});

export const CreateLearningPathSchema = z.object({
  subject: z.string(),
  goals: z.array(LearningGoalSchema)
});