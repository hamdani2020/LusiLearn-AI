import { z } from 'zod';
import { BaseEntity } from './common';
import { AgeRange } from './user';

// Collaboration and peer interaction types
export enum ModerationLevel {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  STRICT = 'strict'
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private'
}

export enum CollaborationActivityType {
  STUDY_SESSION = 'study_session',
  DISCUSSION = 'discussion',
  PROJECT = 'project',
  PEER_REVIEW = 'peer_review'
}

export interface GroupParticipant {
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Date;
  isActive: boolean;
  contributionScore: number;
}

export interface CollaborationActivity {
  id: string;
  type: CollaborationActivityType;
  title: string;
  description: string;
  participants: string[];
  startTime: Date;
  endTime?: Date;
  isCompleted: boolean;
}

export interface StudyGroup extends BaseEntity {
  name: string;
  description: string;
  topic: string;
  subject: string;
  participants: GroupParticipant[];
  settings: {
    maxSize: number;
    ageRestrictions: AgeRange[];
    moderationLevel: ModerationLevel;
    privacy: PrivacyLevel;
    requiresApproval: boolean;
  };
  activities: CollaborationActivity[];
  isActive: boolean;
}

export interface PeerMatch {
  userId: string;
  compatibilityScore: number; // 0-100
  sharedInterests: string[];
  complementarySkills: string[];
  matchReason: string;
  estimatedCollaborationSuccess: number; // 0-100
}

export interface MatchingCriteria {
  subjects: string[];
  skillLevels: string[];
  learningGoals: string[];
  timeZone?: string;
  ageRange?: AgeRange;
  communicationStyle?: 'formal' | 'casual' | 'mixed';
  collaborationType: 'study_buddy' | 'mentor' | 'project_partner';
}

export interface CollaborationPreferences {
  preferredGroupSize: number;
  communicationStyle: 'formal' | 'casual' | 'mixed';
  availableHours: {
    start: string;
    end: string;
    timezone: string;
  };
  subjects: string[];
  collaborationTypes: CollaborationActivityType[];
}

export interface CollaborationSession extends BaseEntity {
  groupId: string;
  participants: string[];
  topic: string;
  duration: number; // in minutes
  activities: {
    type: string;
    duration: number;
    participants: string[];
  }[];
  outcomes: string[];
  satisfaction: {
    userId: string;
    rating: number; // 1-5
    feedback?: string;
  }[];
}

export interface ModerationResult {
  isAppropriate: boolean;
  flaggedContent?: string[];
  severity: 'low' | 'medium' | 'high';
  action: 'none' | 'warning' | 'timeout' | 'ban';
  reason?: string;
}

// Validation schemas
export const GroupParticipantSchema = z.object({
  userId: z.string(),
  role: z.enum(['member', 'moderator', 'admin']),
  joinedAt: z.date(),
  isActive: z.boolean(),
  contributionScore: z.number().min(0).max(100)
});

export const CollaborationActivitySchema = z.object({
  id: z.string(),
  type: z.nativeEnum(CollaborationActivityType),
  title: z.string(),
  description: z.string(),
  participants: z.array(z.string()),
  startTime: z.date(),
  endTime: z.date().optional(),
  isCompleted: z.boolean()
});

export const StudyGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(3).max(50),
  description: z.string().max(500),
  topic: z.string(),
  subject: z.string(),
  participants: z.array(GroupParticipantSchema),
  settings: z.object({
    maxSize: z.number().min(2).max(8),
    ageRestrictions: z.array(z.nativeEnum(AgeRange)),
    moderationLevel: z.nativeEnum(ModerationLevel),
    privacy: z.nativeEnum(PrivacyLevel),
    requiresApproval: z.boolean()
  }),
  activities: z.array(CollaborationActivitySchema),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const PeerMatchSchema = z.object({
  userId: z.string(),
  compatibilityScore: z.number().min(0).max(100),
  sharedInterests: z.array(z.string()),
  complementarySkills: z.array(z.string()),
  matchReason: z.string(),
  estimatedCollaborationSuccess: z.number().min(0).max(100)
});

export const CollaborationPreferencesSchema = z.object({
  preferredGroupSize: z.number().min(2).max(8),
  communicationStyle: z.enum(['formal', 'casual', 'mixed']),
  availableHours: z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string()
  }),
  subjects: z.array(z.string()),
  collaborationTypes: z.array(z.nativeEnum(CollaborationActivityType))
});

export const CollaborationSessionSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  participants: z.array(z.string()),
  topic: z.string(),
  duration: z.number().min(0),
  activities: z.array(z.object({
    type: z.string(),
    duration: z.number(),
    participants: z.array(z.string())
  })),
  outcomes: z.array(z.string()),
  satisfaction: z.array(z.object({
    userId: z.string(),
    rating: z.number().min(1).max(5),
    feedback: z.string().optional()
  })),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const ModerationResultSchema = z.object({
  isAppropriate: z.boolean(),
  flaggedContent: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high']),
  action: z.enum(['none', 'warning', 'timeout', 'ban']),
  reason: z.string().optional()
});

export const MatchingCriteriaSchema = z.object({
  subjects: z.array(z.string()),
  skillLevels: z.array(z.string()),
  learningGoals: z.array(z.string()),
  timeZone: z.string().optional(),
  ageRange: z.nativeEnum(AgeRange).optional(),
  communicationStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
  collaborationType: z.enum(['study_buddy', 'mentor', 'project_partner'])
});

export const CreateStudyGroupSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().max(500),
  topic: z.string(),
  subject: z.string(),
  maxSize: z.number().min(2).max(8),
  ageRestrictions: z.array(z.nativeEnum(AgeRange)).optional(),
  moderationLevel: z.nativeEnum(ModerationLevel),
  privacy: z.nativeEnum(PrivacyLevel)
});