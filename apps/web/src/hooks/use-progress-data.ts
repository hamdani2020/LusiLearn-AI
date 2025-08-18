'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Hook for fetching progress dashboard data
export function useProgressDashboard() {
    return useQuery({
        queryKey: ['progressDashboard'],
        queryFn: () => api.getProgressDashboard(),
        staleTime: 2 * 60 * 1000, // 2 minutes
    })
}

// Hook for fetching progress analytics
export function useProgressAnalytics(timeframe: string) {
    return useQuery({
        queryKey: ['progressAnalytics', timeframe],
        queryFn: () => api.getProgressAnalytics(timeframe),
        enabled: !!timeframe,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching user achievements
export function useUserAchievements() {
    return useQuery({
        queryKey: ['userAchievements'],
        queryFn: () => api.getUserAchievements(),
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}

// Hook for fetching user streaks
export function useUserStreaks() {
    return useQuery({
        queryKey: ['userStreaks'],
        queryFn: () => api.getUserStreaks(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

// Hook for fetching user skills
export function useUserSkills() {
    return useQuery({
        queryKey: ['userSkills'],
        queryFn: () => api.getUserSkills(),
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}

// Hook for tracking milestone completion
export function useTrackMilestone() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ pathId, milestoneId }: { pathId: string; milestoneId: string }) =>
            api.trackMilestone(pathId, milestoneId),
        onSuccess: () => {
            // Invalidate related queries
            queryClient.invalidateQueries({ queryKey: ['learningPaths'] })
            queryClient.invalidateQueries({ queryKey: ['progressDashboard'] })
            queryClient.invalidateQueries({ queryKey: ['userAchievements'] })
            queryClient.invalidateQueries({ queryKey: ['userStreaks'] })
        },
    })
}