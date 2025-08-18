'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, endpoints } from '@/lib/api'

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