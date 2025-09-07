import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  progressApi, 
  ProgressUpdate, 
  LearningAnalytics, 
  ProgressVisualization,
  LearningStreak,
  Achievement,
  SkillProgress
} from '@/lib/api-extended';
import { 
  useBaseHook, 
  useApiCall,
  globalStateRegistry,
  BaseHookState,
  BaseHookActions,
  HookEventEmitterImpl
} from './base';

// Enhanced Progress Tracking Hook Interface
export interface UseProgressTrackingReturn extends BaseHookState<LearningAnalytics>, BaseHookActions {
  // Data
  analytics: LearningAnalytics | null;
  visualization: ProgressVisualization | null;
  streaks: LearningStreak | null;
  achievements: Achievement[];
  skillProgress: SkillProgress[];
  
  // Real-time updates
  isRealTimeEnabled: boolean;
  lastRealTimeUpdate: Date | null;
  
  // Actions
  updateProgress: (data: ProgressUpdate) => Promise<any>;
  fetchAnalytics: (timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly') => Promise<LearningAnalytics | null>;
  fetchVisualization: (pathId: string) => Promise<ProgressVisualization | null>;
  fetchSession: (sessionId: string) => Promise<any>;
  fetchStreaks: () => Promise<LearningStreak | null>;
  fetchGoals: () => Promise<any>;
  fetchAchievements: () => Promise<Achievement[]>;
  fetchSkillProgress: () => Promise<SkillProgress[]>;
  
  // Real-time functionality
  enableRealTimeUpdates: () => void;
  disableRealTimeUpdates: () => void;
  subscribeToProgressUpdates: (callback: (update: ProgressUpdate) => void) => () => void;
  
  // Analytics data management
  setAnalyticsTimeframe: (timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  refreshAnalytics: () => Promise<void>;
  
  // Computed
  hasAnalytics: boolean;
  hasVisualization: boolean;
  currentStreak: number;
  longestStreak: number;
  totalTimeSpent: number;
  averageScore: number;
  totalAchievements: number;
  recentAchievements: Achievement[];
  progressTrend: 'improving' | 'stable' | 'declining';
}

export function useProgressTracking(): UseProgressTrackingReturn {
  // State for different data types
  const [visualization, setVisualization] = useState<ProgressVisualization | null>(null);
  const [streaks, setStreaks] = useState<LearningStreak | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgress[]>([]);
  const [currentTimeframe, setCurrentTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false);
  const [lastRealTimeUpdate, setLastRealTimeUpdate] = useState<Date | null>(null);

  // Base hook for analytics data
  const analyticsHook = useBaseHook<LearningAnalytics>(null, {
    cacheKey: `progress-analytics-${currentTimeframe}`,
    cacheTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000,  // 2 minutes
    onSuccess: (data) => {
      // Sync with global state
      globalStateRegistry.getState<LearningAnalytics>('progress-analytics').set(data);
    }
  });

  // API calls for different operations
  const updateProgressCall = useApiCall<any>({
    endpoint: '/api/v1/progress/update',
    method: 'POST',
    autoFetch: false,
    onSuccess: (data) => {
      // Trigger real-time update
      setLastRealTimeUpdate(new Date());
      // Refresh analytics after progress update
      if (analyticsHook.data) {
        fetchAnalytics(currentTimeframe);
      }
    }
  });

  const analyticsCall = useApiCall<LearningAnalytics>({
    endpoint: `/api/v1/progress/analytics/${currentTimeframe}`,
    method: 'GET',
    dependencies: [currentTimeframe],
    autoFetch: true,
    cacheTime: 5 * 60 * 1000,
    onSuccess: (data) => {
      analyticsHook.setData(data);
    }
  });

  const visualizationCall = useApiCall<ProgressVisualization>({
    endpoint: '/api/v1/progress/visualization/:pathId',
    method: 'GET',
    autoFetch: false,
    onSuccess: (data) => {
      setVisualization(data);
    }
  });

  const sessionCall = useApiCall<any>({
    endpoint: '/api/v1/progress/session/:sessionId',
    method: 'GET',
    autoFetch: false
  });

  const streaksCall = useApiCall<LearningStreak>({
    endpoint: '/api/v1/progress/streaks',
    method: 'GET',
    autoFetch: false,
    onSuccess: (data) => {
      setStreaks(data);
    }
  });

  const goalsCall = useApiCall<any>({
    endpoint: '/api/v1/progress/goals',
    method: 'GET',
    autoFetch: false
  });

  const achievementsCall = useApiCall<Achievement[]>({
    endpoint: '/api/v1/progress/achievements',
    method: 'GET',
    autoFetch: false,
    onSuccess: (data) => {
      setAchievements(data);
    }
  });

  const skillProgressCall = useApiCall<SkillProgress[]>({
    endpoint: '/api/v1/progress/skills',
    method: 'GET',
    autoFetch: false,
    onSuccess: (data) => {
      setSkillProgress(data);
    }
  });

  // Event emitter for real-time updates
  const eventEmitterRef = useRef(new HookEventEmitterImpl<ProgressUpdate>());

  // Update progress
  const updateProgress = useCallback(async (data: ProgressUpdate) => {
    const result = await updateProgressCall.execute(data);
    
    // Emit real-time update event
    if (isRealTimeEnabled) {
      eventEmitterRef.current.emit({
        type: 'success',
        data,
        timestamp: new Date()
      });
    }
    
    return result;
  }, [updateProgressCall, isRealTimeEnabled]);

  // Fetch analytics with caching
  const fetchAnalytics = useCallback(async (timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<LearningAnalytics | null> => {
    if (timeframe !== currentTimeframe) {
      setCurrentTimeframe(timeframe);
    }
    
    return await analyticsCall.execute();
  }, [analyticsCall, currentTimeframe]);

  // Fetch visualization
  const fetchVisualization = useCallback(async (pathId: string): Promise<ProgressVisualization | null> => {
    const endpoint = visualizationCall.endpoint?.replace(':pathId', pathId) || '';
    return await visualizationCall.execute();
  }, [visualizationCall]);

  // Fetch session details
  const fetchSession = useCallback(async (sessionId: string): Promise<any> => {
    const endpoint = sessionCall.endpoint?.replace(':sessionId', sessionId) || '';
    return await sessionCall.execute();
  }, [sessionCall]);

  // Fetch streaks
  const fetchStreaks = useCallback(async (): Promise<LearningStreak | null> => {
    return await streaksCall.execute();
  }, [streaksCall]);

  // Fetch goals
  const fetchGoals = useCallback(async (): Promise<any> => {
    return await goalsCall.execute();
  }, [goalsCall]);

  // Fetch achievements
  const fetchAchievements = useCallback(async (): Promise<Achievement[]> => {
    const result = await achievementsCall.execute();
    return result || [];
  }, [achievementsCall]);

  // Fetch skill progress
  const fetchSkillProgress = useCallback(async (): Promise<SkillProgress[]> => {
    const result = await skillProgressCall.execute();
    return result || [];
  }, [skillProgressCall]);

  // Real-time functionality
  const enableRealTimeUpdates = useCallback(() => {
    setIsRealTimeEnabled(true);
  }, []);

  const disableRealTimeUpdates = useCallback(() => {
    setIsRealTimeEnabled(false);
  }, []);

  const subscribeToProgressUpdates = useCallback((callback: (update: ProgressUpdate) => void) => {
    return eventEmitterRef.current.on('success', (event) => {
      if (event.data) {
        callback(event.data);
      }
    });
  }, []);

  // Analytics data management
  const setAnalyticsTimeframe = useCallback((timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setCurrentTimeframe(timeframe);
  }, []);

  const refreshAnalytics = useCallback(async (): Promise<void> => {
    await fetchAnalytics(currentTimeframe);
  }, [fetchAnalytics, currentTimeframe]);

  // Auto-fetch related data when analytics are loaded
  useEffect(() => {
    if (analyticsHook.data && !streaks) {
      fetchStreaks();
    }
    if (analyticsHook.data && achievements.length === 0) {
      fetchAchievements();
    }
    if (analyticsHook.data && skillProgress.length === 0) {
      fetchSkillProgress();
    }
  }, [analyticsHook.data, streaks, achievements.length, skillProgress.length, fetchStreaks, fetchAchievements, fetchSkillProgress]);

  // Computed values
  const analytics = analyticsHook.data;
  const hasAnalytics = analytics !== null;
  const hasVisualization = visualization !== null;
  const currentStreak = analytics?.currentStreak || streaks?.currentStreak || 0;
  const longestStreak = analytics?.longestStreak || streaks?.longestStreak || 0;
  const totalTimeSpent = analytics?.totalTimeSpent || 0;
  const averageScore = analytics?.averageScore || 0;
  const totalAchievements = achievements.length;
  const recentAchievements = achievements
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
    .slice(0, 5);

  // Calculate progress trend
  const progressTrend: 'improving' | 'stable' | 'declining' = (() => {
    if (!analytics?.subjects || analytics.subjects.length === 0) return 'stable';
    
    const avgScore = analytics.averageScore;
    if (avgScore > 80) return 'improving';
    if (avgScore < 60) return 'declining';
    return 'stable';
  })();

  // Combined loading state
  const loading = analyticsHook.loading || 
                 updateProgressCall.loading || 
                 analyticsCall.loading || 
                 visualizationCall.loading || 
                 sessionCall.loading || 
                 streaksCall.loading || 
                 goalsCall.loading || 
                 achievementsCall.loading || 
                 skillProgressCall.loading;

  // Combined error state
  const error = analyticsHook.error || 
               updateProgressCall.error || 
               analyticsCall.error || 
               visualizationCall.error || 
               sessionCall.error || 
               streaksCall.error || 
               goalsCall.error || 
               achievementsCall.error || 
               skillProgressCall.error;

  return {
    // Base state
    data: analytics,
    loading,
    error,
    lastFetch: analyticsHook.lastFetch,
    isStale: analyticsHook.isStale,

    // Data
    analytics,
    visualization,
    streaks,
    achievements,
    skillProgress,

    // Real-time updates
    isRealTimeEnabled,
    lastRealTimeUpdate,

    // Actions
    updateProgress,
    fetchAnalytics,
    fetchVisualization,
    fetchSession,
    fetchStreaks,
    fetchGoals,
    fetchAchievements,
    fetchSkillProgress,
    clearError: analyticsHook.clearError,
    clearData: analyticsHook.clearData,
    refresh: refreshAnalytics,
    invalidate: analyticsHook.invalidate,

    // Real-time functionality
    enableRealTimeUpdates,
    disableRealTimeUpdates,
    subscribeToProgressUpdates,

    // Analytics data management
    setAnalyticsTimeframe,
    refreshAnalytics,

    // Computed
    hasAnalytics,
    hasVisualization,
    currentStreak,
    longestStreak,
    totalTimeSpent,
    averageScore,
    totalAchievements,
    recentAchievements,
    progressTrend
  };
} 