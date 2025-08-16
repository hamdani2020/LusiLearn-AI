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