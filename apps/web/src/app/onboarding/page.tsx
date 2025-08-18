'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { OnboardingWelcome } from '@/components/onboarding/onboarding-welcome'
import { SkillAssessment } from '@/components/onboarding/skill-assessment'
import { LearningPreferences } from '@/components/onboarding/learning-preferences'
import { GoalSetting } from '@/components/onboarding/goal-setting'
import { PlatformTour } from '@/components/onboarding/platform-tour'
import { FirstSession } from '@/components/onboarding/first-session'
import { OnboardingComplete } from '@/components/onboarding/onboarding-complete'
import { useOnboarding, OnboardingStep } from '@/hooks/use-onboarding'

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.WELCOME)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionData, setSessionData] = useState<any>(null)
  
  const { 
    startOnboarding, 
    getOnboardingSession, 
    updateOnboardingProgress,
    completeOnboarding 
  } = useOnboarding()

  useEffect(() => {
    initializeOnboarding()
  }, [])

  const initializeOnboarding = async () => {
    try {
      setIsLoading(true)
      
      // Check if user already has an onboarding session
      const session = await getOnboardingSession()
      
      if (session) {
        setSessionData(session)
        setCurrentStep(session.currentStep)
        setProgress(session.progress.completionPercentage)
      } else {
        // Start new onboarding session
        const newSession = await startOnboarding()
        setSessionData(newSession)
        setCurrentStep(newSession.currentStep)
        setProgress(newSession.progress.completionPercentage)
      }
    } catch (error) {
      console.error('Error initializing onboarding:', error)
      // Redirect to dashboard if there's an error
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = async (stepData?: any) => {
    try {
      setIsLoading(true)
      
      // Update progress for current step
      if (stepData) {
        await updateOnboardingProgress(currentStep, stepData)
      }

      // Determine next step
      const nextStep = getNextStep(currentStep)
      setCurrentStep(nextStep)
      
      // Update progress percentage
      const newProgress = ((getStepIndex(nextStep) + 1) / 7) * 100
      setProgress(newProgress)

      // If completing onboarding, redirect to dashboard
      if (nextStep === OnboardingStep.COMPLETED) {
        await completeOnboarding()
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      }
    } catch (error) {
      console.error('Error moving to next step:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreviousStep = () => {
    const previousStep = getPreviousStep(currentStep)
    setCurrentStep(previousStep)
    
    const newProgress = ((getStepIndex(previousStep) + 1) / 7) * 100
    setProgress(newProgress)
  }

  const getNextStep = (current: OnboardingStep): OnboardingStep => {
    const steps = [
      OnboardingStep.WELCOME,
      OnboardingStep.SKILL_ASSESSMENT,
      OnboardingStep.LEARNING_PREFERENCES,
      OnboardingStep.GOAL_SETTING,
      OnboardingStep.PLATFORM_TOUR,
      OnboardingStep.FIRST_SESSION,
      OnboardingStep.COMPLETED
    ]
    
    const currentIndex = steps.indexOf(current)
    return steps[Math.min(currentIndex + 1, steps.length - 1)]
  }

  const getPreviousStep = (current: OnboardingStep): OnboardingStep => {
    const steps = [
      OnboardingStep.WELCOME,
      OnboardingStep.SKILL_ASSESSMENT,
      OnboardingStep.LEARNING_PREFERENCES,
      OnboardingStep.GOAL_SETTING,
      OnboardingStep.PLATFORM_TOUR,
      OnboardingStep.FIRST_SESSION,
      OnboardingStep.COMPLETED
    ]
    
    const currentIndex = steps.indexOf(current)
    return steps[Math.max(currentIndex - 1, 0)]
  }

  const getStepIndex = (step: OnboardingStep): number => {
    const steps = [
      OnboardingStep.WELCOME,
      OnboardingStep.SKILL_ASSESSMENT,
      OnboardingStep.LEARNING_PREFERENCES,
      OnboardingStep.GOAL_SETTING,
      OnboardingStep.PLATFORM_TOUR,
      OnboardingStep.FIRST_SESSION,
      OnboardingStep.COMPLETED
    ]
    
    return steps.indexOf(step)
  }

  const getStepTitle = (step: OnboardingStep): string => {
    switch (step) {
      case OnboardingStep.WELCOME:
        return 'Welcome to LusiLearn AI'
      case OnboardingStep.SKILL_ASSESSMENT:
        return 'Skill Assessment'
      case OnboardingStep.LEARNING_PREFERENCES:
        return 'Learning Preferences'
      case OnboardingStep.GOAL_SETTING:
        return 'Set Your Goals'
      case OnboardingStep.PLATFORM_TOUR:
        return 'Platform Tour'
      case OnboardingStep.FIRST_SESSION:
        return 'First Learning Session'
      case OnboardingStep.COMPLETED:
        return 'Onboarding Complete!'
      default:
        return 'Onboarding'
    }
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return <OnboardingWelcome onNext={handleNextStep} />
      
      case OnboardingStep.SKILL_ASSESSMENT:
        return <SkillAssessment onNext={handleNextStep} onPrevious={handlePreviousStep} />
      
      case OnboardingStep.LEARNING_PREFERENCES:
        return <LearningPreferences onNext={handleNextStep} onPrevious={handlePreviousStep} />
      
      case OnboardingStep.GOAL_SETTING:
        return <GoalSetting onNext={handleNextStep} onPrevious={handlePreviousStep} />
      
      case OnboardingStep.PLATFORM_TOUR:
        return <PlatformTour onNext={handleNextStep} onPrevious={handlePreviousStep} />
      
      case OnboardingStep.FIRST_SESSION:
        return <FirstSession onNext={handleNextStep} onPrevious={handlePreviousStep} />
      
      case OnboardingStep.COMPLETED:
        return <OnboardingComplete />
      
      default:
        return <OnboardingWelcome onNext={handleNextStep} />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Setting up your learning experience...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Progress Header */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {getStepTitle(currentStep)}
            </h1>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Step {getStepIndex(currentStep) + 1} of 7
              </span>
              <div className="w-32">
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </div>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-6">
            {[
              OnboardingStep.WELCOME,
              OnboardingStep.SKILL_ASSESSMENT,
              OnboardingStep.LEARNING_PREFERENCES,
              OnboardingStep.GOAL_SETTING,
              OnboardingStep.PLATFORM_TOUR,
              OnboardingStep.FIRST_SESSION,
              OnboardingStep.COMPLETED
            ].map((step, index) => {
              const stepIndex = getStepIndex(step)
              const currentIndex = getStepIndex(currentStep)
              const isCompleted = stepIndex < currentIndex
              const isCurrent = stepIndex === currentIndex
              
              return (
                <div key={step} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isCurrent 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      stepIndex + 1
                    )}
                  </div>
                  {index < 6 && (
                    <div className={`
                      w-12 h-1 mx-2
                      ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-lg">
            <CardContent className="p-8">
              {renderCurrentStep()}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Footer */}
        {currentStep !== OnboardingStep.WELCOME && currentStep !== OnboardingStep.COMPLETED && (
          <div className="max-w-4xl mx-auto mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handlePreviousStep}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>
            
            <div className="text-sm text-gray-600">
              {Math.round(progress)}% Complete
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 