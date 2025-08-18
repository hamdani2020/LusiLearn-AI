'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, ArrowLeft, Compass } from 'lucide-react'

interface PlatformTourProps {
  onNext: (data?: any) => void
  onPrevious: () => void
}

export function PlatformTour({ onNext, onPrevious }: PlatformTourProps) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <Compass className="w-12 h-12 text-blue-500 mr-3" />
          <h2 className="text-3xl font-bold text-gray-900">Platform Tour</h2>
        </div>
        <p className="text-lg text-gray-600">
          Let's explore the key features of LusiLearn AI
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrevious}>
          <ArrowLeft className="mr-2 w-4 h-4" />
          Back
        </Button>
        <Button onClick={() => onNext({ completed: true })}>
          Continue
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  )
} 