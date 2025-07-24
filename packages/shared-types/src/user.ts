import { z } from 'zod';
import { BaseEntity, EducationLevel, LearningStyle, ContentType, IdSchema, EmailSchema } from './common';

// User-related types and interfaces
export enum AgeRange {
  CHILD = '5-12',
  TEEN = '13-17',
  YOUNG_ADULT = '18-25',
  ADULT = '26-40',
  MATURE = '40+'
}

export enum DifficultyPreference {
  GRADUAL = 'gradual',
  MODERATE = 'moderate',
  CHALLENGING = 'challenging'
}

export interface UserDemographics {
  ageRange: AgeRange;
  educationLevel: EducationLevel;
  timezone: string;
  preferredLanguage: string;
}

export interface LearningPreferences {
  learningStyle: LearningStyle[];
  preferredContentTypes: ContentType[];
  sessionDuration: number; // in minutes
  difficultyPreference: DifficultyPreference;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  allowPeerMatching: boolean;
  shareProgressData: boolean;
  allowDataCollection: boolean;
}

export interface ParentalControls {
  parentEmail: string;
  restrictedInteractions: boolean;
  contentFiltering: 'strict' | 'moderate' | 'minimal';
  timeRestrictions: {
    dailyLimit: number; // in minutes
    allowedHours: { start: string; end: string };
  };
}

export interface SkillAssessment {
  subject: string;
  level: number; // 1-10 scale
  confidence: number; // 1-10 scale
  lastAssessed: Date;
}

export interface UserProfile extends BaseEntity {
  email: string;
  username: string;
  demographics: UserDemographics;
  learningPreferences: LearningPreferences;
  skillProfile: SkillAssessment[];
  privacySettings: PrivacySettings;
  parentalControls?: ParentalControls;
  isVerified: boolean;
}

// Validation schemas
export const UserDemographicsSchema = z.object({
  ageRange: z.nativeEnum(AgeRange),
  educationLevel: z.nativeEnum(EducationLevel),
  timezone: z.string(),
  preferredLanguage: z.string()
});

export const LearningPreferencesSchema = z.object({
  learningStyle: z.array(z.nativeEnum(LearningStyle)),
  preferredContentTypes: z.array(z.nativeEnum(ContentType)),
  sessionDuration: z.number().min(5).max(180),
  difficultyPreference: z.nativeEnum(DifficultyPreference)
});

export const CreateUserRequestSchema = z.object({
  email: EmailSchema,
  username: z.string().min(3).max(30),
  demographics: UserDemographicsSchema,
  learningPreferences: LearningPreferencesSchema
});