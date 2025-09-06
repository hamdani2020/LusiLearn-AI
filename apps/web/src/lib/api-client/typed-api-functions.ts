/**
 * Type-safe API functions with comprehensive JSDoc documentation
 * Provides strongly typed API interactions with enhanced IntelliSense support
 */

import { z } from 'zod';
import { ApiResponse, RequestOptions } from './types';
import { EnhancedApiClient } from './client';
import {
  // User types and schemas
  UserProfile,
  CreateUserRequestSchema,
  UserProfileSchema,

  // Learning types and schemas
  LearningPath,
  LearningSession,
  LearningAnalytics,
  ProgressUpdate,
  Achievement,
  CreateLearningPathSchema,
  LearningPathSchema,
  LearningSessionSchema,
  LearningAnalyticsSchema,
  ProgressUpdateSchema,
  AchievementSchema,

  // Content types and schemas
  ContentItem,
  ContentQuery,
  ContentRecommendation,
  ContentItemSchema,
  ContentQuerySchema,
  ContentRecommendationSchema,

  // Collaboration types and schemas
  StudyGroup,
  CollaborationSession,
  PeerMatch,
  CreateStudyGroupSchema,
  StudyGroupSchema,
  CollaborationSessionSchema,
  PeerMatchSchema,

  // Common schemas
  PaginatedResponse,
  PaginationParams,
  PaginationParamsSchema
} from '@lusilearn/shared-types';
import {
  createTypeSafeApiFunction,
  createTypeSafeBatchFunction,
  ApiFunction,
  BatchApiFunction,
  UpdatePayload,
  CreatePayload,
  extractApiResponseData,
  assertSuccessfulApiResponse
} from '../validation/typescript-utils';
import { validateApiResponseData, validateRequestPayloadData } from '../validation';

/**
 * Type-safe API client wrapper with enhanced TypeScript integration
 */
export class TypedApiClient {
  constructor(private client: EnhancedApiClient) { }

  /**
   * User Management API Functions
   */

  /**
   * Creates a new user account with comprehensive validation
   * 
   * @param userData - The user data for account creation
   * @param userData.email - User's email address (must be valid email format)
   * @param userData.username - Unique username (3-30 characters)
   * @param userData.demographics - User demographic information
   * @param userData.learningPreferences - User's learning preferences and settings
   * @param userData.parentalControls - Optional parental controls for minors
   * @param options - Additional request options
   * @param options.timeout - Request timeout in milliseconds (default: 30000)
   * @param options.retries - Number of retry attempts (default: 3)
   * @param options.cache - Whether to cache the response (default: false for POST)
   * 
   * @returns Promise resolving to the created user profile
   * 
   * @throws {ValidationError} When user data validation fails
   * @throws {ApiError} When the API request fails
   * 
   * @example
   * ```typescript
   * const newUser = await typedApi.createUser({
   *   email: 'user@example.com',
   *   username: 'johndoe',
   *   demographics: {
   *     ageRange: AgeRange.YOUNG_ADULT,
   *     educationLevel: EducationLevel.COLLEGE,
   *     timezone: 'America/New_York',
   *     preferredLanguage: 'en'
   *   },
   *   learningPreferences: {
   *     learningStyle: [LearningStyle.VISUAL],
   *     preferredContentTypes: [ContentType.VIDEO],
   *     sessionDuration: 60,
   *     difficultyPreference: DifficultyPreference.MODERATE
   *   }
   * });
   * 
   * if (newUser.success) {
   *   console.log('User created:', newUser.data.id);
   * }
   * ```
   */
  async createUser(
    userData: CreatePayload<UserProfile>,
    options?: RequestOptions
  ): Promise<ApiResponse<UserProfile>> {
    // Validate request data
    const validatedData = CreateUserRequestSchema.parse(userData);

    // Make API call
    const response = await this.client.post<UserProfile>('/api/v1/users', validatedData, options);

    // Validate response if successful
    if (response.success && response.data) {
      const validatedUser = UserProfileSchema.parse(response.data);
      return { ...response, data: validatedUser };
    }

    return response;
  }

  /**
   * Retrieves a user profile by ID with full type safety
   * 
   * @param userId - The unique identifier of the user
   * @param options - Additional request options
   * @param options.cache - Whether to use cached data (default: true)
   * @param options.cacheTTL - Cache time-to-live in milliseconds
   * 
   * @returns Promise resolving to the user profile or null if not found
   * 
   * @throws {ValidationError} When the user ID format is invalid
   * @throws {ApiError} When the API request fails
   * 
   * @example
   * ```typescript
   * const user = await typedApi.getUserById('123e4567-e89b-12d3-a456-426614174000');
   * 
   * if (user.success && user.data) {
   *   console.log('User email:', user.data.email);
   *   console.log('Learning preferences:', user.data.learningPreferences);
   * }
   * ```
   */
  async getUserById(userId: string, options?: RequestOptions): Promise<ApiResponse<UserProfile | null>> {
    // Validate user ID format
    const userIdSchema = z.string().uuid('Invalid user ID format');
    const validatedUserId = userIdSchema.parse(userId);

    const response = await this.client.get<UserProfile>(`/api/v1/users/${validatedUserId}`, options);

    if (response.success && response.data) {
      const validatedUser = UserProfileSchema.parse(response.data);
      return { ...response, data: validatedUser };
    }

    return response;
  }

  /**
   * Updates an existing user profile with partial data
   * 
   * @param userId - The unique identifier of the user to update
   * @param updateData - Partial user data to update
   * @param options - Additional request options
   * 
   * @returns Promise resolving to the updated user profile
   * 
   * @throws {ValidationError} When update data validation fails
   * @throws {ApiError} When the API request fails
   * 
   * @example
   * ```typescript
   * const updatedUser = await typedApi.updateUser('user-id', {
   *   learningPreferences: {
   *     ...existingPreferences,
   *     sessionDuration: 90
   *   }
   * });
   * ```
   */
  async updateUser(
    userId: string,
    updateData: UpdatePayload<UserProfile>,
    options?: RequestOptions
  ): Promise<ApiResponse<UserProfile>> {
    const userIdSchema = z.string().uuid();
    const updateSchema = UserProfileSchema.partial().omit({ id: true, createdAt: true, updatedAt: true }) as unknown as z.ZodType<any, any, any>;

    const validatedUserId = validateRequestPayloadData(userId, userIdSchema, 'updateUser');
    const validatedUpdateData = validateRequestPayloadData(updateData, updateSchema, 'updateUser');

    const response = await this.client.put<UserProfile>(
      `/api/v1/users/${validatedUserId}`,
      validatedUpdateData,
      options
    );

    if (response.success && response.data) {
      const validatedUser = validateApiResponseData(response, UserProfileSchema as any, 'updateUser');
      return { ...response, data: validatedUser as UserProfile };
    }

    return response;
  }

  /**
   * Learning Path Management API Functions
   */

  /**
   * Creates a new learning path with AI-powered personalization
   * 
   * @param pathData - The learning path creation data
   * @param pathData.subject - The subject area for the learning path
   * @param pathData.goals - Array of learning goals and objectives
   * @param options - Additional request options
   * 
   * @returns Promise resolving to the created learning path with generated objectives
   * 
   * @throws {ValidationError} When path data validation fails
   * @throws {ApiError} When the API request fails
   * 
   * @example
   * ```typescript
   * const learningPath = await typedApi.createLearningPath({
   *   subject: 'JavaScript Programming',
   *   goals: [
   *     {
   *       objective: 'Master ES6 features',
   *       timeline: '2 weeks',
   *       priority: 'high'
   *     },
   *     {
   *       objective: 'Learn React framework',
   *       timeline: '1 month',
   *       priority: 'medium'
   *     }
   *   ]
   * });
   * ```
   */
  createLearningPath: ApiFunction<CreatePayload<LearningPath>, LearningPath> = createTypeSafeApiFunction(
    (data, options) => this.client.post('/api/v1/learning-paths', data, options),
    CreateLearningPathSchema as any,
    LearningPathSchema as any
  );

  /**
   * Retrieves all learning paths for the authenticated user
   * 
   * @param params - Pagination and filtering parameters
   * @param params.page - Page number (default: 1)
   * @param params.limit - Items per page (default: 20, max: 100)
   * @param params.sortBy - Field to sort by
   * @param params.sortOrder - Sort order ('asc' or 'desc')
   * @param options - Additional request options
   * 
   * @returns Promise resolving to paginated learning paths
   * 
   * @example
   * ```typescript
   * const paths = await typedApi.getLearningPaths({
   *   page: 1,
   *   limit: 10,
   *   sortBy: 'createdAt',
   *   sortOrder: 'desc'
   * });
   * 
   * if (paths.success) {
   *   console.log(`Found ${paths.data.pagination.total} learning paths`);
   *   paths.data.data.forEach(path => {
   *     console.log(`Path: ${path.subject}, Progress: ${path.progress.overallProgress}%`);
   *   });
   * }
   * ```
   */
  async getLearningPaths(
    params: PaginationParams = { page: 1, limit: 20 },
    options?: RequestOptions
  ): Promise<ApiResponse<PaginatedResponse<LearningPath>>> {
    const validatedParams = validateRequestPayloadData(params, PaginationParamsSchema as any, 'getLearningPaths');

    const validatedPaginationParams = validatedParams as PaginationParams;
    const queryString = new URLSearchParams({
      page: validatedPaginationParams.page.toString(),
      limit: validatedPaginationParams.limit.toString(),
      ...(validatedPaginationParams.sortBy && { sortBy: validatedPaginationParams.sortBy }),
      ...(validatedPaginationParams.sortOrder && { sortOrder: validatedPaginationParams.sortOrder })
    }).toString();

    const response = await this.client.get<PaginatedResponse<LearningPath>>(
      `/api/v1/learning-paths?${queryString}`,
      options
    );

    if (response.success && response.data) {
      // Validate each learning path in the response
      const paginatedSchema = z.object({
        data: z.array(LearningPathSchema as any),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          totalPages: z.number()
        })
      });

      const validatedData = validateApiResponseData(response, paginatedSchema, 'getLearningPaths');
      return { ...response, data: validatedData as PaginatedResponse<LearningPath> };
    }

    return response;
  }

  /**
   * Content Discovery and Recommendation API Functions
   */

  /**
   * Searches for educational content with AI-powered recommendations
   * 
   * @param query - Content search and filtering parameters
   * @param query.query - Search query string
   * @param query.subject - Subject area filter
   * @param query.difficulty - Difficulty level filter
   * @param query.format - Content format filter
   * @param query.ageRating - Age rating filter
   * @param query.duration - Duration range filter
   * @param query.page - Page number for pagination
   * @param query.limit - Items per page
   * @param options - Additional request options
   * 
   * @returns Promise resolving to search results with relevance scoring
   * 
   * @throws {ValidationError} When query parameters are invalid
   * @throws {ApiError} When the search request fails
   * 
   * @example
   * ```typescript
   * const searchResults = await typedApi.searchContent({
   *   query: 'machine learning basics',
   *   subject: 'Computer Science',
   *   difficulty: DifficultyLevel.BEGINNER,
   *   format: ContentFormat.VIDEO,
   *   ageRating: AgeRating.ALL_AGES,
   *   duration: { min: 300, max: 1800 }, // 5-30 minutes
   *   page: 1,
   *   limit: 20
   * });
   * 
   * if (searchResults.success) {
   *   searchResults.data.forEach(item => {
   *     console.log(`${item.title} - ${item.metadata.duration}s - Rating: ${item.qualityMetrics.userRating}`);
   *   });
   * }
   * ```
   */
  async searchContent(
    query: ContentQuery,
    options?: RequestOptions
  ): Promise<ApiResponse<ContentItem[]>> {
    const validatedQuery = validateRequestPayloadData(query, ContentQuerySchema as any, 'searchContent');

    const response = await this.client.post<ContentItem[]>(
      '/api/v1/content/search',
      validatedQuery,
      options
    );

    if (response.success && response.data) {
      const contentArraySchema = z.array(ContentItemSchema as any);
      const validatedContent = validateApiResponseData(response, contentArraySchema, 'searchContent');
      return { ...response, data: validatedContent as ContentItem[] };
    }

    return response;
  }

  /**
   * Gets personalized content recommendations based on user profile and learning history
   * 
   * @param userId - The user ID for personalized recommendations
   * @param context - Learning context for better recommendations
   * @param context.currentTopic - Current learning topic
   * @param context.userSkillLevel - User's skill level
   * @param context.sessionGoals - Goals for the current session
   * @param context.timeConstraints - Available time in minutes
   * @param context.preferredFormats - Preferred content formats
   * @param options - Additional request options
   * 
   * @returns Promise resolving to personalized content recommendations
   * 
   * @example
   * ```typescript
   * const recommendations = await typedApi.getContentRecommendations('user-id', {
   *   currentTopic: 'React Hooks',
   *   userSkillLevel: DifficultyLevel.INTERMEDIATE,
   *   sessionGoals: ['Understand useEffect', 'Practice custom hooks'],
   *   timeConstraints: 45,
   *   preferredFormats: [ContentFormat.VIDEO, ContentFormat.INTERACTIVE]
   * });
   * ```
   */
  async getContentRecommendations(
    userId: string,
    context: {
      currentTopic: string;
      userSkillLevel: string;
      sessionGoals: string[];
      timeConstraints: number;
      preferredFormats: string[];
    },
    options?: RequestOptions
  ): Promise<ApiResponse<ContentRecommendation[]>> {
    const userIdSchema = z.string().uuid();
    const contextSchema = z.object({
      currentTopic: z.string(),
      userSkillLevel: z.string(),
      sessionGoals: z.array(z.string()),
      timeConstraints: z.number().min(0),
      preferredFormats: z.array(z.string())
    });

    const validatedUserId = validateRequestPayloadData(userId, userIdSchema, 'getContentRecommendations');
    const validatedContext = validateRequestPayloadData(context, contextSchema, 'getContentRecommendations');

    const response = await this.client.post<ContentRecommendation[]>(
      `/api/v1/users/${validatedUserId}/recommendations`,
      validatedContext,
      options
    );

    if (response.success && response.data) {
      const recommendationsSchema = z.array(ContentRecommendationSchema as any);
      const validatedRecommendations = validateApiResponseData(response, recommendationsSchema, 'getContentRecommendations');
      return { ...response, data: validatedRecommendations as ContentRecommendation[] };
    }

    return response;
  }

  /**
   * Collaboration and Study Groups API Functions
   */

  /**
   * Creates a new study group with specified settings and moderation
   * 
   * @param groupData - Study group creation data
   * @param groupData.name - Group name (3-50 characters)
   * @param groupData.description - Group description (max 500 characters)
   * @param groupData.topic - Main topic of study
   * @param groupData.subject - Subject area
   * @param groupData.maxSize - Maximum number of participants (2-8)
   * @param groupData.ageRestrictions - Age restrictions for participants
   * @param groupData.moderationLevel - Level of content moderation
   * @param groupData.privacy - Privacy level of the group
   * @param options - Additional request options
   * 
   * @returns Promise resolving to the created study group
   * 
   * @example
   * ```typescript
   * const studyGroup = await typedApi.createStudyGroup({
   *   name: 'JavaScript Beginners',
   *   description: 'A group for learning JavaScript fundamentals',
   *   topic: 'JavaScript Programming',
   *   subject: 'Computer Science',
   *   maxSize: 6,
   *   ageRestrictions: [AgeRange.YOUNG_ADULT, AgeRange.ADULT],
   *   moderationLevel: ModerationLevel.MODERATE,
   *   privacy: PrivacyLevel.PUBLIC
   * });
   * ```
   */
  createStudyGroup: ApiFunction<CreatePayload<StudyGroup>, StudyGroup> = createTypeSafeApiFunction(
    (data, options) => this.client.post('/api/v1/collaboration/study-groups', data, options),
    CreateStudyGroupSchema as any,
    StudyGroupSchema as any
  );

  /**
   * Finds compatible peers for collaboration based on learning goals and preferences
   * 
   * @param criteria - Matching criteria for finding peers
   * @param criteria.subjects - Subjects of interest
   * @param criteria.skillLevels - Skill levels to match
   * @param criteria.learningGoals - Learning goals to align
   * @param criteria.timeZone - Preferred time zone
   * @param criteria.ageRange - Age range preference
   * @param criteria.communicationStyle - Communication style preference
   * @param criteria.collaborationType - Type of collaboration desired
   * @param options - Additional request options
   * 
   * @returns Promise resolving to compatible peer matches with compatibility scores
   * 
   * @example
   * ```typescript
   * const peerMatches = await typedApi.findCompatiblePeers({
   *   subjects: ['JavaScript', 'React'],
   *   skillLevels: ['intermediate'],
   *   learningGoals: ['Build projects', 'Prepare for interviews'],
   *   timeZone: 'America/New_York',
   *   ageRange: AgeRange.YOUNG_ADULT,
   *   communicationStyle: 'casual',
   *   collaborationType: 'study_buddy'
   * });
   * 
   * if (peerMatches.success) {
   *   peerMatches.data.forEach(match => {
   *     console.log(`Match: ${match.userId}, Compatibility: ${match.compatibilityScore}%`);
   *   });
   * }
   * ```
   */
  async findCompatiblePeers(
    criteria: {
      subjects: string[];
      skillLevels: string[];
      learningGoals: string[];
      timeZone?: string;
      ageRange?: string;
      communicationStyle?: 'formal' | 'casual' | 'mixed';
      collaborationType: 'study_buddy' | 'mentor' | 'project_partner';
    },
    options?: RequestOptions
  ): Promise<ApiResponse<PeerMatch[]>> {
    const criteriaSchema = z.object({
      subjects: z.array(z.string()),
      skillLevels: z.array(z.string()),
      learningGoals: z.array(z.string()),
      timeZone: z.string().optional(),
      ageRange: z.string().optional(),
      communicationStyle: z.enum(['formal', 'casual', 'mixed']).optional(),
      collaborationType: z.enum(['study_buddy', 'mentor', 'project_partner'])
    });

    const validatedCriteria = validateRequestPayloadData(criteria, criteriaSchema, 'findCompatiblePeers');

    const response = await this.client.post<PeerMatch[]>(
      '/api/v1/collaboration/peer-matching',
      validatedCriteria,
      options
    );

    if (response.success && response.data) {
      const peerMatchesSchema = z.array(PeerMatchSchema as any);
      const validatedMatches = validateApiResponseData(response, peerMatchesSchema, 'findCompatiblePeers');
      return { ...response, data: validatedMatches as PeerMatch[] };
    }

    return response;
  }

  /**
   * Progress Tracking and Analytics API Functions
   */

  /**
   * Records learning progress for a session with comprehensive metrics
   * 
   * @param progressData - Progress data to record
   * @param progressData.sessionId - Unique session identifier
   * @param progressData.userId - User identifier
   * @param progressData.pathId - Learning path identifier
   * @param progressData.timestamp - When the progress was made
   * @param progressData.progressData - Detailed progress metrics
   * @param options - Additional request options
   * 
   * @returns Promise resolving to confirmation of recorded progress
   * 
   * @example
   * ```typescript
   * const progressUpdate = await typedApi.recordProgress({
   *   sessionId: 'session-123',
   *   userId: 'user-456',
   *   pathId: 'path-789',
   *   timestamp: new Date(),
   *   progressData: {
   *     objectivesCompleted: ['obj-1', 'obj-2'],
   *     milestonesReached: ['milestone-1'],
   *     skillsImproved: ['javascript', 'react'],
   *     timeSpent: 3600, // 1 hour in seconds
   *     comprehensionScore: 85,
   *     engagementLevel: 92
   *   }
   * });
   * ```
   */
  recordProgress: ApiFunction<ProgressUpdate, { success: boolean; message: string }> = createTypeSafeApiFunction(
    (data, options) => this.client.post('/api/v1/progress/record', data, options),
    ProgressUpdateSchema as any,
    z.object({ success: z.boolean(), message: z.string() })
  );

  /**
   * Retrieves comprehensive learning analytics for a user
   * 
   * @param userId - User identifier
   * @param timeframe - Analytics timeframe
   * @param options - Additional request options
   * 
   * @returns Promise resolving to detailed learning analytics
   * 
   * @example
   * ```typescript
   * const analytics = await typedApi.getLearningAnalytics('user-id', 'weekly');
   * 
   * if (analytics.success) {
   *   const data = analytics.data;
   *   console.log(`Total time: ${data.metrics.totalTimeSpent} minutes`);
   *   console.log(`Comprehension trend: ${data.metrics.comprehensionTrend}`);
   *   console.log(`Next milestone ETA: ${data.predictions.nextMilestoneETA}`);
   * }
   * ```
   */
  async getLearningAnalytics(
    userId: string,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly',
    options?: RequestOptions
  ): Promise<ApiResponse<LearningAnalytics>> {
    const userIdSchema = z.string().uuid();
    const timeframeSchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

    const validatedUserId = validateRequestPayloadData(userId, userIdSchema, 'getLearningAnalytics');
    const validatedTimeframe = validateRequestPayloadData(timeframe, timeframeSchema, 'getLearningAnalytics');

    const response = await this.client.get<LearningAnalytics>(
      `/api/v1/users/${validatedUserId}/analytics?timeframe=${validatedTimeframe}`,
      options
    );

    if (response.success && response.data) {
      const validatedAnalytics = validateApiResponseData(response, LearningAnalyticsSchema as any, 'getLearningAnalytics');
      return { ...response, data: validatedAnalytics as LearningAnalytics };
    }

    return response;
  }
}

/**
 * Factory function for creating a typed API client instance
 * 
 * @param client - The enhanced API client instance
 * @returns Typed API client with full type safety and validation
 * 
 * @example
 * ```typescript
 * import { createApiClient } from './client';
 * import { createTypedApiClient } from './typed-api-functions';
 * 
 * const apiClient = createApiClient();
 * const typedApi = createTypedApiClient(apiClient);
 * 
 * // Now use with full type safety
 * const user = await typedApi.getUserById('user-id');
 * ```
 */
export function createTypedApiClient(client: EnhancedApiClient): TypedApiClient {
  return new TypedApiClient(client);
}

/**
 * Default typed API client instance
 * Uses the default enhanced API client with validation middleware
 */

export const typedApiClient = new TypedApiClient(new EnhancedApiClient());