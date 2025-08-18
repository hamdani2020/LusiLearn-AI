'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, ArrowLeft, Brain } from 'lucide-react'

interface SkillAssessmentProps {
  onNext: (data?: any) => void
  onPrevious: () => void
}

export function SkillAssessment({ onNext, onPrevious }: SkillAssessmentProps) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <Brain className="w-12 h-12 text-blue-500 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900">Skill Assessment</h2>
        </div>
        <p className="text-lg text-gray-600">
          Let's understand your current knowledge level to personalize your learning experience
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Assessment Overview</CardTitle>
          <CardDescription>
            This assessment will help us determine your starting level and recommend the best learning path
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-left space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>10-15 questions across different subjects</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Takes about 5-10 minutes to complete</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>No right or wrong answers - just be honest about your comfort level</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <Button onClick={() => onNext({ completed: true })}>
          Start Assessment
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  )
} 