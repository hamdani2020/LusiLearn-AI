import { api, ApiResponse, ApiError } from './api';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Goals Types
export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: 'academic' | 'career' | 'personal' | 'skill';
  targetDate: string;
  progress: number;
  status: 'active' | 'completed' | 'overdue';
  milestones: GoalMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string;
}

export interface CreateGoalRequest {
  title: string;
  description: string;
  category: 'academic' | 'career' | 'personal' | 'skill';
  targetDate: string;
  milestones?: {
    title: string;
    dueDate: string;
  }[];
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  category?: 'academic' | 'career' | 'personal' | 'skill';
  targetDate?: string;
  progress?: number;
  status?: 'active' | 'completed' | 'overdue';
  milestones?: GoalMilestone[];
}

// Learning Path Types
export interface LearningPath {
  id: string;
  subject: string;
  currentLevel: string;
  objectives: string[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  order: number;
}

export interface CreateLearningPathRequest {
  subject: string;
  goals: string[];
}

export interface UpdateLearningPathRequest {
  subject?: string;
  currentLevel?: string;
  objectives?: string[];
  milestones?: Milestone[];
}

export interface ShareLearningPathRequest {
  sharedWithUserId: string;
  permissions: 'view' | 'collaborate';
  message?: string;
}

// Progress Tracking Types
export interface ProgressUpdate {
  sessionId: string;
  comprehensionScore: number;
  timeSpent: number;
  strugglingConcepts: string[];
  masteredConcepts: string[];
}

export interface LearningAnalytics {
  totalTimeSpent: number;
  averageScore: number;
  completedSessions: number;
  currentStreak: number;
  longestStreak: number;
  subjects: SubjectProgress[];
}

export interface SubjectProgress {
  subject: string;
  timeSpent: number;
  averageScore: number;
  sessionsCompleted: number;
}

export interface ProgressVisualization {
  pathId: string;
  milestones: MilestoneProgress[];
  overallProgress: number;
  estimatedCompletion: string;
}

export interface MilestoneProgress {
  milestoneId: string;
  title: string;
  completed: boolean;
  completionDate?: string;
  score?: number;
}

// Assessment Types
export interface AssessmentQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  skillArea: string;
}

export interface AssessmentResponse {
  questionId: string;
  selectedAnswer: string;
  timeSpent: number;
}

export interface AssessmentSubmission {
  subject: string;
  responses: AssessmentResponse[];
}

export interface AssessmentResult {
  id: string;
  subject: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  skillBreakdown: SkillBreakdown[];
  recommendations: string[];
}

export interface SkillBreakdown {
  skill: string;
  score: number;
  strength: 'weak' | 'moderate' | 'strong';
}

export interface SkillGapAnalysis {
  targetLevels: Record<string, number>;
}

// Collaboration Types
export interface PeerMatch {
  userId: string;
  username: string;
  subjects: string[];
  skillLevel: string;
  availability: string[];
  matchScore: number;
}

export interface MatchingCriteria {
  subjects: string[];
  skillLevel: string;
  availability: string[];
  maxDistance?: number;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
  maxSize: number;
  currentMembers: number;
  privacy: 'public' | 'friends' | 'private';
  moderationLevel: 'minimal' | 'moderate' | 'strict';
  createdAt: string;
  createdBy: string;
}

export interface CreateStudyGroupRequest {
  name: string;
  description: string;
  subject: string;
  topic: string;
  maxSize: number;
  ageRestrictions: string[];
  moderationLevel: 'minimal' | 'moderate' | 'strict';
  privacy: 'public' | 'friends' | 'private';
}

export interface UpdateStudyGroupRequest {
  name?: string;
  description?: string;
  maxSize?: number;
  privacy?: 'public' | 'friends' | 'private';
  moderationLevel?: 'minimal' | 'moderate' | 'strict';
}

// Adaptive Difficulty Types
export interface DifficultyAnalysis {
  userId: string;
  subject: string;
  currentDifficulty: number;
  recommendedDifficulty: number;
  confidence: number;
  factors: DifficultyFactor[];
}

export interface DifficultyFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface DifficultyRecommendation {
  subject: string;
  recommendedLevel: number;
  reasoning: string;
  confidence: number;
}

export interface DifficultyAdjustment {
  subject: string;
  newLevel: number;
  reason: string;
}

// Safety & Moderation Types
export interface ContentFilterRequest {
  content: string;
  contentType: 'text' | 'image' | 'video';
  userId: string;
  context?: string;
}

export interface ContentFilterResponse {
  isAppropriate: boolean;
  confidence: number;
  flaggedContent?: string[];
  reason?: string;
}

export interface ContentReport {
  contentType: 'text' | 'image' | 'video';
  contentId: string;
  reporterId: string;
  reason: string;
  description?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ModerationStatus {
  userId: string;
  status: 'clean' | 'warned' | 'suspended' | 'banned';
  warnings: number;
  lastReview: string;
  nextReview?: string;
}

// ============================================================================
// GOALS API METHODS
// ============================================================================

export const goalsAPI = {
  // Get all goals for the current user
  getGoals: () => api.get<{ data: Goal[] }>('/api/v1/goals'),

  // Get a specific goal by ID
  getGoal: (goalId: string) => api.get<{ data: Goal }>(`/api/v1/goals/${goalId}`),

  // Create a new goal
  createGoal: (data: CreateGoalRequest) => api.post<{ data: Goal }>('/api/v1/goals', data),

  // Update a goal
  updateGoal: (goalId: string, data: UpdateGoalRequest) => api.put<{ data: Goal }>(`/api/v1/goals/${goalId}`, data),

  // Delete a goal
  deleteGoal: (goalId: string) => api.delete(`/api/v1/goals/${goalId}`),

  // Mark a milestone as completed
  completeMilestone: (goalId: string, milestoneId: string) => 
    api.post(`/api/v1/goals/${goalId}/milestones/${milestoneId}/complete`),
};

// ============================================================================
// LEARNING PATH API METHODS
// ============================================================================

export const learningPathApi = {
  // Create a new learning path
  async create(data: CreateLearningPathRequest): Promise<ApiResponse<LearningPath>> {
    return api.post<LearningPath>('/api/v1/learning-paths', data);
  },

  // Get all learning paths for the user
  async getAll(): Promise<ApiResponse<LearningPath[]>> {
    return api.get<LearningPath[]>('/api/v1/learning-paths');
  },

  // Get a specific learning path
  async getById(pathId: string): Promise<ApiResponse<LearningPath>> {
    return api.get<LearningPath>(`/api/v1/learning-paths/${pathId}`);
  },

  // Update a learning path
  async update(pathId: string, data: UpdateLearningPathRequest): Promise<ApiResponse<LearningPath>> {
    return api.put<LearningPath>(`/api/v1/learning-paths/${pathId}`, data);
  },

  // Delete a learning path
  async delete(pathId: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/api/v1/learning-paths/${pathId}`);
  },

  // Update progress for a learning path
  async updateProgress(pathId: string, data: ProgressUpdate): Promise<ApiResponse<any>> {
    return api.post<any>(`/api/v1/learning-paths/${pathId}/progress`, data);
  },

  // Share a learning path
  async share(pathId: string, data: ShareLearningPathRequest): Promise<ApiResponse<any>> {
    return api.post<any>(`/api/v1/learning-paths/${pathId}/share`, data);
  }
};

// ============================================================================
// PROGRESS TRACKING API METHODS
// ============================================================================

export const progressApi = {
  // Update progress
  async updateProgress(data: ProgressUpdate): Promise<ApiResponse<any>> {
    return api.post<any>('/api/v1/progress/update', data);
  },

  // Get learning analytics
  async getAnalytics(timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<ApiResponse<LearningAnalytics>> {
    return api.get<LearningAnalytics>(`/api/v1/progress/analytics/${timeframe}`);
  },

  // Get progress visualization for a learning path
  async getVisualization(pathId: string): Promise<ApiResponse<ProgressVisualization>> {
    return api.get<ProgressVisualization>(`/api/v1/progress/visualization/${pathId}`);
  },

  // Get session details
  async getSession(sessionId: string): Promise<ApiResponse<any>> {
    return api.get<any>(`/api/v1/progress/session/${sessionId}`);
  },

  // Get learning streaks
  async getStreaks(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/progress/streaks');
  },

  // Get learning goals
  async getGoals(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/progress/goals');
  }
};

// ============================================================================
// ASSESSMENT API METHODS
// ============================================================================

export const assessmentApi = {
  // Get assessment questions
  async getQuestions(subject: string, count: number = 20): Promise<ApiResponse<{ questions: AssessmentQuestion[] }>> {
    return api.get<{ questions: AssessmentQuestion[] }>(`/api/v1/assessments/questions?subject=${subject}&count=${count}`);
  },

  // Submit assessment
  async submit(data: AssessmentSubmission): Promise<ApiResponse<AssessmentResult>> {
    return api.post<AssessmentResult>('/api/v1/assessments/submit', data);
  },

  // Get assessment results
  async getResults(assessmentId: string): Promise<ApiResponse<AssessmentResult>> {
    return api.get<AssessmentResult>(`/api/v1/assessments/results/${assessmentId}`);
  },

  // Analyze skill gaps
  async analyzeSkillGaps(data: SkillGapAnalysis): Promise<ApiResponse<any>> {
    return api.post<any>('/api/v1/assessments/skill-gap-analysis', data);
  },

  // Get learning recommendations
  async getRecommendations(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/assessments/recommendations');
  }
};

// ============================================================================
// COLLABORATION API METHODS
// ============================================================================

export const collaborationApi = {
  // Find peer matches
  async findPeerMatches(criteria: MatchingCriteria): Promise<ApiResponse<{ matches: PeerMatch[] }>> {
    return api.post<{ matches: PeerMatch[] }>('/api/v1/collaboration/peer-matching', criteria);
  },

  // Create study group
  async createStudyGroup(data: CreateStudyGroupRequest): Promise<ApiResponse<StudyGroup>> {
    return api.post<StudyGroup>('/api/v1/collaboration/study-groups', data);
  },

  // Get all study groups
  async getStudyGroups(): Promise<ApiResponse<StudyGroup[]>> {
    return api.get<StudyGroup[]>('/api/v1/collaboration/study-groups');
  },

  // Get specific study group
  async getStudyGroup(groupId: string): Promise<ApiResponse<StudyGroup>> {
    return api.get<StudyGroup>(`/api/v1/collaboration/study-groups/${groupId}`);
  },

  // Update study group
  async updateStudyGroup(groupId: string, data: UpdateStudyGroupRequest): Promise<ApiResponse<StudyGroup>> {
    return api.put<StudyGroup>(`/api/v1/collaboration/study-groups/${groupId}`, data);
  },

  // Delete study group
  async deleteStudyGroup(groupId: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/api/v1/collaboration/study-groups/${groupId}`);
  },

  // Join study group
  async joinStudyGroup(groupId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/api/v1/collaboration/study-groups/${groupId}/join`);
  },

  // Leave study group
  async leaveStudyGroup(groupId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/api/v1/collaboration/study-groups/${groupId}/leave`);
  }
};

// ============================================================================
// ADAPTIVE DIFFICULTY API METHODS
// ============================================================================

export const adaptiveDifficultyApi = {
  // Analyze user performance
  async analyzePerformance(subject: string): Promise<ApiResponse<DifficultyAnalysis>> {
    return api.post<DifficultyAnalysis>('/api/v1/adaptive-difficulty/analyze', { subject });
  },

  // Get difficulty recommendations
  async getRecommendations(): Promise<ApiResponse<DifficultyRecommendation[]>> {
    return api.get<DifficultyRecommendation[]>('/api/v1/adaptive-difficulty/recommendations');
  },

  // Adjust difficulty settings
  async adjustDifficulty(data: DifficultyAdjustment): Promise<ApiResponse<any>> {
    return api.put<any>('/api/v1/adaptive-difficulty/adjust', data);
  }
};

// ============================================================================
// SAFETY & MODERATION API METHODS
// ============================================================================

export const safetyApi = {
  // Filter content
  async filterContent(data: ContentFilterRequest): Promise<ApiResponse<ContentFilterResponse>> {
    return api.post<ContentFilterResponse>('/api/v1/safety/content-filter', data);
  },

  // Report inappropriate content
  async reportContent(data: ContentReport): Promise<ApiResponse<any>> {
    return api.post<any>('/api/v1/safety/report', data);
  },

  // Get moderation status
  async getModerationStatus(): Promise<ApiResponse<ModerationStatus>> {
    return api.get<ModerationStatus>('/api/v1/safety/moderation-status');
  }
};

// ============================================================================
// MONITORING API METHODS
// ============================================================================

export const monitoringApi = {
  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/monitoring/health');
  },

  // Get metrics
  async getMetrics(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/monitoring/metrics');
  },

  // Get logs
  async getLogs(): Promise<ApiResponse<any>> {
    return api.get<any>('/api/v1/monitoring/logs');
  }
};

// ============================================================================
// EXPORT ALL API MODULES
// ============================================================================

export const apiExtended = {
  learningPaths: learningPathApi,
  progress: progressApi,
  assessments: assessmentApi,
  collaboration: collaborationApi,
  adaptiveDifficulty: adaptiveDifficultyApi,
  safety: safetyApi,
  monitoring: monitoringApi
};

export default apiExtended; 