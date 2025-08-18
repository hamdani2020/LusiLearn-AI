'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Sparkles } from 'lucide-react'

export function OnboardingComplete() {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-green-500 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900">Onboarding Complete!</h2>
        </div>
        <p className="text-lg text-gray-600">
          Congratulations! Your personalized learning experience is ready
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-blue-500 mr-2" />
            Welcome to LusiLearn AI!
          </CardTitle>
          <CardDescription>
            You're all set to start your AI-powered learning journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-left space-y-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Your learning profile has been created</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Personalized content recommendations are ready</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Your first learning path has been generated</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>You can now connect with study partners</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-gray-600 mb-4">
          Redirecting you to your dashboard...
        </p>
        <div className="animate-pulse">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  )
} 