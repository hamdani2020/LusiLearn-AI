/**
 * Comprehensive Zod validation schemas for API request/response types
 * This module provides runtime validation for all API interactions
 */

import { z } from 'zod';

// Re-export shared schemas from packages/shared-types
export {
  // Common schemas
  IdSchema,
  EmailSchema,
  TimestampSchema,
  BaseEntitySchema,
  PaginationParamsSchema,
  ApiResponseSchema,
  
  // User schemas
  UserDemographicsSchema,
  LearningPreferencesSchema,
  SkillAssessmentSchema,
  PrivacySettingsSchema,
  ParentalControlsSchema,
  UserProfileSchema,
  CreateUserRequestSchema,
  
  // Learning schemas
  LearningObjectiveSchema,
  MilestoneSchema,
  PathAdaptationSchema,
  LearningPathSchema,
  UserInteractionSchema,
  AssessmentResultSchema,
  EngagementMetricsSchema,
  LearningSessionSchema,
  LearningGoalSchema,
  CreateLearningPathSchema,
  ProgressUpdateSchema,
  AchievementSchema,
  LearningStreakSchema,
  SkillProgressSchema,
  LearningAnalyticsSchema,
  DifficultyAdjustmentResultSchema,
  ContentSequenceResultSchema,
  CompetencyTestResultSchema,
  OptimalChallengeAnalysisSchema,
  OnboardingStepSchema,
  OnboardingProgressSchema,
  SkillAssessmentResultSchema,
  GoalSettingSchema,
  
  // Content schemas
  ContentMetadataSchema,
  QualityMetricsSchema,
  ContentItemSchema,
  ContentQuerySchema,
  ContentRecommendationSchema,
  LearningContextSchema,
  
  // Collaboration schemas
  GroupParticipantSchema,
  CollaborationActivitySchema,
  StudyGroupSchema,
  PeerMatchSchema,
  CollaborationPreferencesSchema,
  CollaborationSessionSchema,
  ModerationResultSchema,
  MatchingCriteriaSchema,
  CreateStudyGroupSchema
} from '@lusilearn/shared-types';

// API Client specific validation schemas
export const ErrorTypeSchema = z.enum([
  'network',
  'authentication',
  'authorization',
  'validation',
  'server',
  'timeout',
  'rate_limit',
  'unknown'
]);

export const RequestOptionsSchema = z.object({
  timeout: z.number().min(1000).max(300000).optional(), // 1s to 5min
  retries: z.number().min(0).max(10).optional(),
  cache: z.boolean().optional(),
  cacheTTL: z.number().min(0).optional(),
  signal: z.instanceof(AbortSignal).optional(),
  headers: z.record(z.string(), z.string()).optional()
});

export const ApiResponseMetadataSchema = z.object({
  requestId: z.string(),
  timestamp: z.string().datetime(),
  duration: z.number().min(0),
  cached: z.boolean(),
  retryCount: z.number().min(0),
  source: z.enum(['api', 'cache', 'optimistic'])
});

export const PaginationMetadataSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  total: z.number().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

export const EnhancedApiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  metadata: ApiResponseMetadataSchema.optional(),
  pagination: PaginationMetadataSchema.optional()
});

export const BatchRequestSchema = z.object({
  id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  endpoint: z.string(),
  data: z.any().optional(),
  options: RequestOptionsSchema.optional()
});

export const BatchResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  results: z.array(z.object({
    id: z.string(),
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional()
  })),
  metadata: z.object({
    totalRequests: z.number().min(0),
    successfulRequests: z.number().min(0),
    failedRequests: z.number().min(0),
    duration: z.number().min(0)
  })
});

export const UploadProgressSchema = z.object({
  loaded: z.number().min(0),
  total: z.number().min(0),
  percentage: z.number().min(0).max(100),
  speed: z.number().min(0),
  remainingTime: z.number().min(0),
  chunkIndex: z.number().min(0).optional(),
  totalChunks: z.number().min(1).optional()
});

export const ApiErrorSchema = z.object({
  type: ErrorTypeSchema,
  message: z.string(),
  code: z.string().optional(),
  status: z.number().min(100).max(599).optional(),
  details: z.any().optional(),
  timestamp: z.date(),
  requestId: z.string().optional(),
  recoverable: z.boolean(),
  retryAfter: z.number().min(0).optional()
});

export const RequestMetadataSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  method: z.string(),
  timestamp: z.date(),
  duration: z.number().min(0).optional(),
  status: z.number().min(100).max(599).optional(),
  error: z.string().optional(),
  retryCount: z.number().min(0),
  cached: z.boolean(),
  size: z.number().min(0).optional()
});

export const ApiMetricsSchema = z.object({
  totalRequests: z.number().min(0),
  successfulRequests: z.number().min(0),
  failedRequests: z.number().min(0),
  averageResponseTime: z.number().min(0),
  cacheHitRate: z.number().min(0).max(1),
  errorsByType: z.record(z.string(), z.number().min(0)),
  slowestEndpoints: z.array(z.object({
    endpoint: z.string(),
    averageTime: z.number().min(0),
    requestCount: z.number().min(0)
  })),
  requestsPerMinute: z.number().min(0),
  lastReset: z.date()
});

// WebSocket validation schemas
export const WebSocketMessageSchema = z.object({
  type: z.string(),
  channel: z.string(),
  data: z.any(),
  timestamp: z.string().datetime(),
  id: z.string().optional()
});

export const ConnectionStateSchema = z.enum([
  'connecting',
  'connected',
  'disconnected',
  'error',
  'reconnecting'
]);

export const WebSocketOptionsSchema = z.object({
  autoReconnect: z.boolean().optional(),
  reconnectInterval: z.number().min(1000).optional(),
  maxReconnectAttempts: z.number().min(0).optional(),
  heartbeatInterval: z.number().min(1000).optional()
});

// Real-time collaboration schemas
export const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().optional(),
  isActive: z.boolean(),
  joinedAt: z.date(),
  role: z.enum(['participant', 'moderator', 'admin']).optional()
});

export const MessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string(),
  timestamp: z.date(),
  type: z.enum(['text', 'system', 'file', 'code']).optional()
});

export const CollaborationSessionStateSchema = z.object({
  sessionId: z.string(),
  isConnected: z.boolean(),
  participants: z.array(ParticipantSchema),
  messages: z.array(MessageSchema),
  isScreenSharing: z.boolean(),
  sharedScreenId: z.string().optional()
});

// Cache validation schemas
export const CacheEntrySchema = z.object({
  key: z.string(),
  value: z.any(),
  ttl: z.number().min(0),
  createdAt: z.date(),
  expiresAt: z.date(),
  size: z.number().min(0).optional()
});

export const CacheStatsSchema = z.object({
  totalEntries: z.number().min(0),
  totalSize: z.number().min(0),
  hitCount: z.number().min(0),
  missCount: z.number().min(0),
  hitRate: z.number().min(0).max(1),
  evictionCount: z.number().min(0)
});

// Hook state validation schemas
export const BaseHookStateSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: dataSchema.nullable(),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.date().nullable(),
  isStale: z.boolean()
});

export const HookOptionsSchema = z.object({
  autoFetch: z.boolean().optional(),
  cacheTime: z.number().min(0).optional(),
  staleTime: z.number().min(0).optional(),
  refetchOnWindowFocus: z.boolean().optional(),
  refetchOnReconnect: z.boolean().optional()
});

// Monitoring and analytics schemas
export const CostMetricsSchema = z.object({
  totalCost: z.number().min(0),
  costByService: z.record(z.string(), z.number().min(0)),
  costByUser: z.record(z.string(), z.number().min(0)),
  costByTimeframe: z.array(z.object({
    date: z.string().date(),
    cost: z.number().min(0)
  })),
  budgetUsage: z.number().min(0).max(1),
  projectedMonthlyCost: z.number().min(0)
});

export const UserAnalyticsSchema = z.object({
  userId: z.string(),
  sessionCount: z.number().min(0),
  totalTimeSpent: z.number().min(0),
  averageSessionDuration: z.number().min(0),
  engagementScore: z.number().min(0).max(100),
  retentionRate: z.number().min(0).max(1),
  featureUsage: z.record(z.string(), z.number().min(0)),
  learningProgress: z.number().min(0).max(100),
  collaborationHours: z.number().min(0)
});

export const PlatformMetricsSchema = z.object({
  activeUsers: z.number().min(0),
  totalSessions: z.number().min(0),
  averageResponseTime: z.number().min(0),
  errorRate: z.number().min(0).max(1),
  systemLoad: z.number().min(0).max(100),
  databaseConnections: z.number().min(0),
  cacheHitRate: z.number().min(0).max(1),
  apiCallsPerMinute: z.number().min(0)
});

// Validation utility schemas
export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
  value: z.any().optional()
});

export const ApiValidationResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  errors: z.array(ValidationErrorSchema).optional()
});

// Type inference helpers
export type RequestOptions = z.infer<typeof RequestOptionsSchema>;
export type ApiResponseMetadata = z.infer<typeof ApiResponseMetadataSchema>;
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;
export type BatchRequest = z.infer<typeof BatchRequestSchema>;
export type UploadProgress = z.infer<typeof UploadProgressSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;
export type ApiMetrics = z.infer<typeof ApiMetricsSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type ConnectionState = z.infer<typeof ConnectionStateSchema>;
export type WebSocketOptions = z.infer<typeof WebSocketOptionsSchema>;
export type Participant = z.infer<typeof ParticipantSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type CollaborationSessionState = z.infer<typeof CollaborationSessionStateSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export type CacheStats = z.infer<typeof CacheStatsSchema>;
export type HookOptions = z.infer<typeof HookOptionsSchema>;
export type CostMetrics = z.infer<typeof CostMetricsSchema>;
export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;
export type PlatformMetrics = z.infer<typeof PlatformMetricsSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type ApiValidationResult = z.infer<typeof ApiValidationResultSchema>;

// Generic type helpers
export type EnhancedApiResponse<T> = z.infer<ReturnType<typeof EnhancedApiResponseSchema<z.ZodType<T>>>>;
export type BatchResponse<T> = z.infer<ReturnType<typeof BatchResponseSchema<z.ZodType<T>>>>;
export type BaseHookState<T> = z.infer<ReturnType<typeof BaseHookStateSchema<z.ZodType<T>>>>;