'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, BookOpen, Users, Target } from 'lucide-react'

interface OnboardingWelcomeProps {
  onNext: (data?: any) => void
}

export function OnboardingWelcome({ onNext }: OnboardingWelcomeProps) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-12 h-12 text-blue-500 mr-3" />
          <h1 className="text-4xl font-bold text-gray-900">Welcome to LusiLearn AI</h1>
        </div>
        <p className="text-xl text-gray-600 mb-6">
          Your personalized AI-powered learning journey starts here
        </p>
        <p className="text-gray-500">
          Let's set up your learning experience in just a few minutes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-2 border-blue-100 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center mb-2">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Adaptive Learning</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              AI-powered content that adapts to your learning style and pace
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-100 bg-green-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-lg">Peer Collaboration</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Connect with study partners and learn together in real-time
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-100 bg-purple-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-center mb-2">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Goal Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Set and track your learning goals with detailed progress analytics
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What we'll set up together:</h3>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Skill Assessment
          </Badge>
          <Badge variant="secondary" className="text-sm">
            Learning Preferences
          </Badge>
          <Badge variant="secondary" className="text-sm">
            Goal Setting
          </Badge>
          <Badge variant="secondary" className="text-sm">
            Platform Tour
          </Badge>
          <Badge variant="secondary" className="text-sm">
            First Session
          </Badge>
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={() => onNext()} 
          size="lg" 
          className="px-8 py-3 text-lg"
        >
          Get Started
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>

      <p className="text-sm text-gray-500 mt-6">
        This will take about 5-10 minutes to complete
      </p>
    </div>
  )
} 