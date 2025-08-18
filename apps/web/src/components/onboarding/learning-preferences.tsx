'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

interface LearningPreferencesProps {
  onNext: (data: any) => void
  onPrevious: () => void
}

export function LearningPreferences({ onNext, onPrevious }: LearningPreferencesProps) {
  const [preferences, setPreferences] = useState({
    learningStyle: ['visual'],
    preferredContentTypes: ['video'],
    sessionDuration: 45,
    difficultyPreference: 'moderate'
  })

  const handleNext = () => {
    onNext(preferences)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Learning Preferences
        </h2>
        <p className="text-gray-600">
          Help us personalize your learning experience
        </p>
      </div>

      <div className="space-y-6">
        {/* Learning Style */}
        <Card>
          <CardHeader>
            <CardTitle>How do you prefer to learn?</CardTitle>
            <CardDescription>
              Select your preferred learning styles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {['visual', 'auditory', 'kinesthetic', 'reading_writing'].map((style) => (
                <Button
                  key={style}
                  variant={preferences.learningStyle.includes(style) ? 'default' : 'outline'}
                  onClick={() => {
                    const newStyles = preferences.learningStyle.includes(style)
                      ? preferences.learningStyle.filter(s => s !== style)
                      : [...preferences.learningStyle, style]
                    setPreferences({ ...preferences, learningStyle: newStyles })
                  }}
                  className="h-12"
                >
                  {style.charAt(0).toUpperCase() + style.slice(1).replace('_', ' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Types */}
        <Card>
          <CardHeader>
            <CardTitle>Preferred Content Types</CardTitle>
            <CardDescription>
              What types of content do you enjoy most?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {['video', 'text', 'interactive', 'audio'].map((type) => (
                <Button
                  key={type}
                  variant={preferences.preferredContentTypes.includes(type) ? 'default' : 'outline'}
                  onClick={() => {
                    const newTypes = preferences.preferredContentTypes.includes(type)
                      ? preferences.preferredContentTypes.filter(t => t !== type)
                      : [...preferences.preferredContentTypes, type]
                    setPreferences({ ...preferences, preferredContentTypes: newTypes })
                  }}
                  className="h-12"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Session Duration */}
        <Card>
          <CardHeader>
            <CardTitle>Session Duration</CardTitle>
            <CardDescription>
              How long do you prefer your learning sessions to be?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{preferences.sessionDuration} minutes</Label>
              <Slider
                value={[preferences.sessionDuration]}
                onValueChange={(value) => setPreferences({ ...preferences, sessionDuration: value[0] })}
                max={120}
                min={15}
                step={15}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>15 min</span>
                <span>120 min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Difficulty Preference */}
        <Card>
          <CardHeader>
            <CardTitle>Difficulty Preference</CardTitle>
            <CardDescription>
              What level of challenge do you prefer?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={preferences.difficultyPreference}
              onValueChange={(value) => setPreferences({ ...preferences, difficultyPreference: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy - Build confidence</SelectItem>
                <SelectItem value="moderate">Moderate - Balanced challenge</SelectItem>
                <SelectItem value="hard">Hard - Push your limits</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={handleNext}>
          Next
        </Button>
      </div>
    </div>
  )
} 