'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, endpoints } from '@/lib/api'
import { goalsAPI, progressAPI, Goal, CreateGoalRequest, UpdateGoalRequest, LearningSession, LearningAnalytics, ProgressVisualization, Achievement, LearningStreak, SkillProgress, ProgressDashboard } from '@/lib/api-extended'

// Types for learning data
export interface LearningPath {
    id: string
    userId: string
    subject: string
    currentLevel: string
    objectives: LearningObjective[]
    progress: {
        completedObjectives: string[]
        currentMilestone: string
        overallProgress: number
        estimatedCompletion: string
    }
}

export interface LearningObjective {
    id: string
    title: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedDuration: number
    completed: boolean
}

export interface ContentRecommendation {
    id: string
    title: string
    description: string
    source: string
    url: string
    difficulty: string
    duration: number
    rating: number
}

// Hook for fetching user's learning paths
export function useLearningPaths(userId: string) {
    return useQuery({
        queryKey: ['learningPaths', userId],
        queryFn: () => api.getLearningPaths(),
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching a specific learning path
export function useLearningPath(pathId: string) {
    return useQuery({
        queryKey: ['learningPath', pathId],
        queryFn: () => api.getLearningPath(pathId),
        enabled: !!pathId,
    })
}

// Hook for creating a new learning path
export function useCreateLearningPath() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: any) => api.createLearningPath(data),
        onSuccess: () => {
            // Invalidate and refetch learning paths
            queryClient.invalidateQueries({ queryKey: ['learningPaths'] })
        },
    })
}

// Hook for updating learning progress
export function useUpdateProgress() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ pathId, progressData }: { pathId: string; progressData: any }) =>
            api.updateLearningProgress(pathId, progressData),
        onSuccess: (_data, { pathId }) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['learningPath', pathId] })
            queryClient.invalidateQueries({ queryKey: ['learningPaths'] })
            queryClient.invalidateQueries({ queryKey: ['progressDashboard'] })
        },
    })
}

// Hook for fetching content recommendations
export function useContentRecommendations(userId: string, topic?: string) {
    return useQuery({
        queryKey: ['recommendations', userId, topic],
        queryFn: () => {
            const url = topic
                ? `${endpoints.content.recommendations(userId)}?topic=${encodeURIComponent(topic)}`
                : endpoints.content.recommendations(userId)
            return api.get<{ data: ContentRecommendation[] }>(url)
        },
        enabled: !!userId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}

// Hook for searching content
export function useContentSearch(query: string, filters?: any) {
    return useQuery({
        queryKey: ['contentSearch', query, filters],
        queryFn: () => {
            const params = new URLSearchParams()
            if (query) params.append('q', query)
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value) params.append(key, String(value))
                })
            }
            return api.get<{ data: ContentRecommendation[] }>(`${endpoints.content.search}?${params}`)
        },
        enabled: !!query && query.length > 2,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching user's goals
export function useGoals() {
    return useQuery({
        queryKey: ['goals'],
        queryFn: () => goalsAPI.getGoals(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching a specific goal
export function useGoal(goalId: string) {
    return useQuery({
        queryKey: ['goal', goalId],
        queryFn: () => goalsAPI.getGoal(goalId),
        enabled: !!goalId,
    })
}

// Hook for creating a new goal
export function useCreateGoal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateGoalRequest) => goalsAPI.createGoal(data),
        onSuccess: () => {
            // Invalidate and refetch goals
            queryClient.invalidateQueries({ queryKey: ['goals'] })
        },
    })
}

// Hook for updating a goal
export function useUpdateGoal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ goalId, data }: { goalId: string; data: UpdateGoalRequest }) =>
            goalsAPI.updateGoal(goalId, data),
        onSuccess: (_data, { goalId }) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['goals'] })
            queryClient.invalidateQueries({ queryKey: ['goal', goalId] })
        },
    })
}

// Hook for deleting a goal
export function useDeleteGoal() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (goalId: string) => goalsAPI.deleteGoal(goalId),
        onSuccess: () => {
            // Invalidate and refetch goals
            queryClient.invalidateQueries({ queryKey: ['goals'] })
        },
    })
}

// Hook for completing a milestone
export function useCompleteMilestone() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ goalId, milestoneId }: { goalId: string; milestoneId: string }) =>
            goalsAPI.completeMilestone(goalId, milestoneId),
        onSuccess: (_data, { goalId }) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['goals'] })
            queryClient.invalidateQueries({ queryKey: ['goal', goalId] })
        },
    })
}

// ============================================================================
// PROGRESS TRACKING HOOKS
// ============================================================================

// Hook for updating learning session progress
export function useUpdateLearningProgress() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: LearningSession) => progressAPI.updateProgress(data),
        onSuccess: () => {
            // Invalidate progress-related queries
            queryClient.invalidateQueries({ queryKey: ['progressDashboard'] })
            queryClient.invalidateQueries({ queryKey: ['analytics'] })
            queryClient.invalidateQueries({ queryKey: ['streaks'] })
        },
    })
}

// Hook for fetching learning analytics
export function useLearningAnalytics(timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return useQuery({
        queryKey: ['analytics', timeframe],
        queryFn: () => progressAPI.getAnalytics(timeframe),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching progress visualization for a learning path
export function useProgressVisualization(pathId: string) {
    return useQuery({
        queryKey: ['progressVisualization', pathId],
        queryFn: () => progressAPI.getVisualization(pathId),
        enabled: !!pathId,
    })
}

// Hook for tracking milestone completion
export function useTrackMilestone() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ pathId, milestoneId }: { pathId: string; milestoneId: string }) =>
            progressAPI.trackMilestone(pathId, milestoneId),
        onSuccess: (_data, { pathId }) => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['learningPath', pathId] })
            queryClient.invalidateQueries({ queryKey: ['progressVisualization', pathId] })
            queryClient.invalidateQueries({ queryKey: ['achievements'] })
        },
    })
}

// Hook for fetching user achievements
export function useAchievements(type?: string) {
    return useQuery({
        queryKey: ['achievements', type],
        queryFn: () => progressAPI.getAchievements(type),
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}

// Hook for fetching progress dashboard data
export function useProgressDashboard() {
    return useQuery({
        queryKey: ['progressDashboard'],
        queryFn: () => progressAPI.getDashboard(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching learning streaks
export function useLearningStreaks() {
    return useQuery({
        queryKey: ['streaks'],
        queryFn: () => progressAPI.getStreaks(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching skill progress
export function useSkillProgress() {
    return useQuery({
        queryKey: ['skillProgress'],
        queryFn: () => progressAPI.getSkills(),
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}