// Local type definitions for the web app
// This is a temporary workaround for the shared-types package issue

export enum AgeRange {
  CHILD = '5-12',
  TEEN = '13-17',
  YOUNG_ADULT = '18-25',
  ADULT = '26-40',
  MATURE = '40+'
}

export enum EducationLevel {
  ELEMENTARY = 'elementary',
  MIDDLE_SCHOOL = 'middle_school',
  HIGH_SCHOOL = 'high_school',
  COLLEGE = 'college',
  GRADUATE = 'graduate',
  PROFESSIONAL = 'professional'
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic',
  READING_WRITING = 'reading_writing',
  HANDS_ON = 'hands_on'
}

export enum ContentType {
  VIDEO = 'video',
  TEXT = 'text',
  INTERACTIVE = 'interactive',
  AUDIO = 'audio'
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
  sessionDuration: number;
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
    dailyLimit: number;
    allowedHours: { start: string; end: string };
  };
}

export interface SkillAssessment {
  subject: string;
  level: number;
  confidence: number;
  lastAssessed: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  demographics: UserDemographics;
  learningPreferences: LearningPreferences;
  skillProfile: SkillAssessment[];
  privacySettings: PrivacySettings;
  parentalControls?: ParentalControls;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Content-related types
export enum ContentSource {
  YOUTUBE = 'youtube',
  KHAN_ACADEMY = 'khan_academy',
  COURSERA = 'coursera',
  GITHUB = 'github',
  INTERNAL = 'internal'
}

export enum ContentFormat {
  VIDEO = 'video',
  ARTICLE = 'article',
  INTERACTIVE = 'interactive',
  QUIZ = 'quiz',
  PROJECT = 'project',
  TUTORIAL = 'tutorial'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum AgeRating {
  ALL_AGES = 'all_ages',
  TEEN = 'teen',
  ADULT = 'adult'
}

export interface ContentMetadata {
  duration: number;
  difficulty: DifficultyLevel;
  subject: string;
  topics: string[];
  format: ContentFormat;
  language: string;
}

export interface QualityMetrics {
  userRating: number;
  completionRate: number;
  effectivenessScore: number;
  lastUpdated: Date;
}

export interface ContentItem {
  id: string;
  source: ContentSource;
  externalId: string;
  url: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  metadata: ContentMetadata;
  qualityMetrics: QualityMetrics;
  ageRating: AgeRating;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentRecommendation {
  content: ContentItem;
  relevanceScore: number;
  reason: string;
  matchedSkills: string[];
}

export interface ContentSearchQuery {
  query?: string;
  subject?: string;
  difficulty?: DifficultyLevel;
  format?: ContentFormat;
  source?: ContentSource;
  ageRating?: AgeRating;
  duration?: {
    min?: number;
    max?: number;
  };
  page?: number;
  limit?: number;
}

export interface ContentSearchResult {
  items: ContentItem[];
  total: number;
  page: number;
  totalPages: number;
  filters: {
    subjects: string[];
    difficulties: DifficultyLevel[];
    formats: ContentFormat[];
    sources: ContentSource[];
  };
}

export interface BookmarkedContent {
  id: string;
  userId: string;
  contentId: string;
  content: ContentItem;
  tags: string[];
  notes?: string;
  createdAt: Date;
}

export interface ContentInteraction {
  id: string;
  userId: string;
  contentId: string;
  interactionType: 'view' | 'complete' | 'bookmark' | 'rate' | 'share';
  duration?: number;
  progress?: number;
  rating?: number;
  timestamp: Date;
}