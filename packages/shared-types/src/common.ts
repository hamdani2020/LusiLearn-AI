import { z } from 'zod';

// Common enums and types used across the platform
export enum EducationLevel {
  K12 = 'k12',
  COLLEGE = 'college',
  PROFESSIONAL = 'professional'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum ContentSource {
  YOUTUBE = 'youtube',
  KHAN_ACADEMY = 'khan_academy',
  COURSERA = 'coursera',
  GITHUB = 'github',
  INTERNAL = 'internal'
}

export enum AgeRating {
  ALL_AGES = 'all_ages',
  TEEN = 'teen',
  ADULT = 'adult'
}

export enum ContentFormat {
  VIDEO = 'video',
  ARTICLE = 'article',
  INTERACTIVE = 'interactive',
  QUIZ = 'quiz',
  PROJECT = 'project'
}

export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  KINESTHETIC = 'kinesthetic',
  READING_WRITING = 'reading_writing'
}

export enum ContentType {
  VIDEO = 'video',
  TEXT = 'text',
  INTERACTIVE = 'interactive',
  AUDIO = 'audio'
}

// Common validation schemas
export const IdSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const TimestampSchema = z.date();

// Base interface for all entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}