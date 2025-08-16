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

// Adaptive Difficulty Types
export interface DifficultyAdjustmentResult {
  newDifficulty: DifficultyLevel;
  reason: string;
  confidence: number; // 0-100
  recommendedActions: string[];
}

export interface ContentSequenceResult {
  nextObjectives: LearningObjective[];
  prerequisitesMet: boolean;
  blockedObjectives: string[];
  recommendedReview: string[];
}

export interface CompetencyTestResult {
  passed: boolean;
  score: number;
  skillsAssessed: string[];
  weakAreas: string[];
  readyForAdvancement: boolean;
}

export interface OptimalChallengeAnalysis {
  currentChallengeLevel: number; // 0-100
  isOptimal: boolean; // true if between 70-85%
  adjustment: 'increase' | 'decrease' | 'maintain';
  targetComprehension: number;
}

// Progress Tracking Types
export interface ProgressUpdate {
  sessionId: string;
  userId: string;
  pathId: string;
  timestamp: Date;
  progressData: {
    objectivesCompleted: string[];
    milestonesReached: string[];
    skillsImproved: string[];
    timeSpent: number;
    comprehensionScore: number;
    engagementLevel: number;
  };
}

export interface Achievement {
  id: string;
  type: 'milestone' | 'streak' | 'skill_mastery' | 'collaboration' | 'consistency';
  title: string;
  description: string;
  iconUrl?: string;
  criteria: Record<string, any>;
  earnedAt: Date;
  points: number;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakType: 'daily' | 'weekly' | 'monthly';
}

export interface SkillProgress {
  skillId: string;
  skillName: string;
  currentLevel: number; // 0-100
  previousLevel: number;
  improvementRate: number; // percentage change
  lastAssessed: Date;
  masteryThreshold: number;
  isMastered: boolean;
}

export interface LearningAnalytics {
  userId: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly';
  metrics: {
    totalTimeSpent: number; // in minutes
    sessionsCompleted: number;
    averageSessionDuration: number;
    comprehensionTrend: number[]; // array of scores over time
    engagementTrend: number[]; // array of engagement scores
    objectivesCompleted: number;
    milestonesReached: number;
    skillsImproved: number;
    achievementsEarned: number;
    collaborationHours: number;
    consistencyScore: number; // 0-100
  };
  insights: {
    strongestSubjects: string[];
    improvementAreas: string[];
    optimalLearningTimes: string[];
    recommendedSessionDuration: number;
    learningVelocity: number; // objectives per week
    retentionRate: number; // percentage
  };
  predictions: {
    nextMilestoneETA: Date;
    goalCompletionProbability: number;
    suggestedFocusAreas: string[];
    riskFactors: string[];
  };
}

export interface ProgressVisualizationData {
  userId: string;
  pathId: string;
  overallProgress: {
    percentage: number;
    completedObjectives: number;
    totalObjectives: number;
    estimatedCompletion: Date;
  };
  milestoneProgress: {
    milestoneId: string;
    title: string;
    progress: number; // 0-100
    isCompleted: boolean;
    completedAt?: Date;
    objectives: {
      id: string;
      title: string;
      isCompleted: boolean;
      completedAt?: Date;
    }[];
  }[];
  skillProgression: SkillProgress[];
  timeSeriesData: {
    date: string;
    comprehensionScore: number;
    timeSpent: number;
    engagementLevel: number;
  }[];
  achievements: Achievement[];
  streaks: LearningStreak[];
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
  timestamp: z.string().datetime().transform((str) => new Date(str)),
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
  createdAt: z.string().datetime().transform((str) => new Date(str)),
  updatedAt: z.string().datetime().transform((str) => new Date(str))
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

// Progress Tracking Validation Schemas
export const ProgressUpdateSchema = z.object({
  sessionId: IdSchema,
  userId: IdSchema,
  pathId: IdSchema,
  timestamp: z.date(),
  progressData: z.object({
    objectivesCompleted: z.array(z.string()),
    milestonesReached: z.array(z.string()),
    skillsImproved: z.array(z.string()),
    timeSpent: z.number().min(0),
    comprehensionScore: z.number().min(0).max(100),
    engagementLevel: z.number().min(0).max(100)
  })
});

export const AchievementSchema = z.object({
  id: IdSchema,
  type: z.enum(['milestone', 'streak', 'skill_mastery', 'collaboration', 'consistency']),
  title: z.string(),
  description: z.string(),
  iconUrl: z.string().optional(),
  criteria: z.record(z.any()),
  earnedAt: z.date(),
  points: z.number().min(0)
});

export const LearningStreakSchema = z.object({
  currentStreak: z.number().min(0),
  longestStreak: z.number().min(0),
  lastActivityDate: z.date(),
  streakType: z.enum(['daily', 'weekly', 'monthly'])
});

export const SkillProgressSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  currentLevel: z.number().min(0).max(100),
  previousLevel: z.number().min(0).max(100),
  improvementRate: z.number(),
  lastAssessed: z.date(),
  masteryThreshold: z.number().min(0).max(100),
  isMastered: z.boolean()
});

export const LearningAnalyticsSchema = z.object({
  userId: IdSchema,
  timeframe: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  metrics: z.object({
    totalTimeSpent: z.number().min(0),
    sessionsCompleted: z.number().min(0),
    averageSessionDuration: z.number().min(0),
    comprehensionTrend: z.array(z.number()),
    engagementTrend: z.array(z.number()),
    objectivesCompleted: z.number().min(0),
    milestonesReached: z.number().min(0),
    skillsImproved: z.number().min(0),
    achievementsEarned: z.number().min(0),
    collaborationHours: z.number().min(0),
    consistencyScore: z.number().min(0).max(100)
  }),
  insights: z.object({
    strongestSubjects: z.array(z.string()),
    improvementAreas: z.array(z.string()),
    optimalLearningTimes: z.array(z.string()),
    recommendedSessionDuration: z.number().min(0),
    learningVelocity: z.number().min(0),
    retentionRate: z.number().min(0).max(100)
  }),
  predictions: z.object({
    nextMilestoneETA: z.date(),
    goalCompletionProbability: z.number().min(0).max(100),
    suggestedFocusAreas: z.array(z.string()),
    riskFactors: z.array(z.string())
  })
});

// Adaptive Difficulty Validation Schemas
export const DifficultyAdjustmentResultSchema = z.object({
  newDifficulty: z.nativeEnum(DifficultyLevel),
  reason: z.string(),
  confidence: z.number().min(0).max(100),
  recommendedActions: z.array(z.string())
});

export const ContentSequenceResultSchema = z.object({
  nextObjectives: z.array(LearningObjectiveSchema),
  prerequisitesMet: z.boolean(),
  blockedObjectives: z.array(z.string()),
  recommendedReview: z.array(z.string())
});

export const CompetencyTestResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  skillsAssessed: z.array(z.string()),
  weakAreas: z.array(z.string()),
  readyForAdvancement: z.boolean()
});

export const OptimalChallengeAnalysisSchema = z.object({
  currentChallengeLevel: z.number().min(0).max(100),
  isOptimal: z.boolean(),
  adjustment: z.enum(['increase', 'decrease', 'maintain']),
  targetComprehension: z.number().min(0).max(100)
});