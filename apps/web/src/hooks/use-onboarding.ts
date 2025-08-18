import { useState } from 'react'
import { api } from '@/lib/api'

// Define OnboardingStep enum locally since it's not exported yet
export enum OnboardingStep {
  WELCOME = 'WELCOME',
  SKILL_ASSESSMENT = 'SKILL_ASSESSMENT',
  LEARNING_PREFERENCES = 'LEARNING_PREFERENCES',
  GOAL_SETTING = 'GOAL_SETTING',
  PLATFORM_TOUR = 'PLATFORM_TOUR',
  FIRST_SESSION = 'FIRST_SESSION',
  COMPLETED = 'COMPLETED'
}

export interface OnboardingSession {
  id: string
  userId: string
  currentStep: OnboardingStep
  progress: {
    completedSteps: OnboardingStep[]
    currentStep: OnboardingStep
    totalSteps: number
    completionPercentage: number
  }
  skillAssessment?: any
  learningPreferences?: any
  goals?: any[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface SkillAssessmentQuestion {
  id: string
  category: string
  question: string
  type: 'multiple_choice' | 'true_false' | 'rating' | 'text'
  options?: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  weight: number
}

export interface SkillAssessmentResult {
  overallScore: number
  categoryScores: Record<string, number>
  recommendedLevel: 'beginner' | 'intermediate' | 'advanced'
  strengths: string[]
  areasForImprovement: string[]
  confidence: number
}

export interface OnboardingRecommendation {
  recommendedSubjects: string[]
  suggestedGoals: any[]
  learningPathPreview?: any
  nextSteps: string[]
}

export function useOnboarding() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startOnboarding = async (): Promise<OnboardingSession> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/start')
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to start onboarding')
      }
      
      return response.data as OnboardingSession
    } catch (err: any) {
      setError(err.message || 'Failed to start onboarding')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const getOnboardingSession = async (): Promise<OnboardingSession | null> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.get('/api/v1/onboarding/session')
      
      if (!response.success) {
        if (response.error === 'No active onboarding session found') {
          return null
        }
        throw new Error(response.message || 'Failed to get onboarding session')
      }
      
      return response.data as OnboardingSession | null
    } catch (err: any) {
      setError(err.message || 'Failed to get onboarding session')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const getOnboardingStatus = async (): Promise<{ isCompleted: boolean; currentStep?: OnboardingStep; progress?: any }> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.get('/api/v1/onboarding/status')
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to get onboarding status')
      }
      
      return response.data as { isCompleted: boolean; currentStep?: OnboardingStep; progress?: any }
    } catch (err: any) {
      setError(err.message || 'Failed to get onboarding status')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const generateSkillAssessmentQuestions = async (subject?: string): Promise<{
    questions: SkillAssessmentQuestion[]
    totalQuestions: number
    estimatedDuration: number
  }> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/skill-assessment/questions', {
        subject
      })
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate skill assessment questions')
      }
      
      return response.data as {
        questions: SkillAssessmentQuestion[]
        totalQuestions: number
        estimatedDuration: number
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate skill assessment questions')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const evaluateSkillAssessment = async (answers: Record<string, any>): Promise<SkillAssessmentResult> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/skill-assessment/evaluate', {
        answers
      })
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to evaluate skill assessment')
      }
      
      return response.data as SkillAssessmentResult
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate skill assessment')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const generateLearningPreferences = async (skillAssessment?: SkillAssessmentResult): Promise<any> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/learning-preferences', {
        skillAssessment
      })
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate learning preferences')
      }
      
      return response.data as any
    } catch (err: any) {
      setError(err.message || 'Failed to generate learning preferences')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const generateGoalRecommendations = async (
    skillAssessment?: SkillAssessmentResult,
    learningPreferences?: any
  ): Promise<any[]> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/goals', {
        skillAssessment,
        learningPreferences
      })
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to generate goal recommendations')
      }
      
      return response.data as any[]
    } catch (err: any) {
      setError(err.message || 'Failed to generate goal recommendations')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateOnboardingProgress = async (step: OnboardingStep, data?: any): Promise<OnboardingSession> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/progress', {
        step,
        data
      })
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to update onboarding progress')
      }
      
      return response.data as OnboardingSession
    } catch (err: any) {
      setError(err.message || 'Failed to update onboarding progress')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const completeOnboarding = async (): Promise<OnboardingRecommendation> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await api.post('/api/v1/onboarding/complete')
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to complete onboarding')
      }
      
      return response.data as OnboardingRecommendation
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    error,
    startOnboarding,
    getOnboardingSession,
    getOnboardingStatus,
    generateSkillAssessmentQuestions,
    evaluateSkillAssessment,
    generateLearningPreferences,
    generateGoalRecommendations,
    updateOnboardingProgress,
    completeOnboarding
  }
} 