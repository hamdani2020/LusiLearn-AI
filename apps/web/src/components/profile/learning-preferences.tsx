'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Brain, Clock, Target, Zap } from 'lucide-react'
import { 
  LearningStyle, 
  ContentType, 
  DifficultyPreference,
  LearningPreferences as LearningPreferencesType 
} from '@/types'

const learningPreferencesSchema = z.object({
  learningStyle: z.array(z.nativeEnum(LearningStyle)).min(1, 'Please select at least one learning style'),
  preferredContentTypes: z.array(z.nativeEnum(ContentType)).min(1, 'Please select at least one content type'),
  sessionDuration: z.number().min(5, 'Session duration must be at least 5 minutes').max(180, 'Session duration cannot exceed 180 minutes'),
  difficultyPreference: z.nativeEnum(DifficultyPreference),
  studySchedule: z.object({
    preferredDays: z.array(z.string()).min(1, 'Please select at least one day'),
    preferredTimeSlots: z.array(z.string()).min(1, 'Please select at least one time slot'),
  }),
  focusAreas: z.array(z.string()).min(1, 'Please select at least one focus area'),
  motivationFactors: z.array(z.string()).min(1, 'Please select at least one motivation factor'),
})

type LearningPreferencesData = z.infer<typeof learningPreferencesSchema>

interface LearningPreferencesProps {
  preferences: LearningPreferencesType & {
    studySchedule?: {
      preferredDays: string[]
      preferredTimeSlots: string[]
    }
    focusAreas?: string[]
    motivationFactors?: string[]
  }
  onUpdatePreferences: (data: LearningPreferencesData) => Promise<void>
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

const TIME_SLOTS = [
  'Early Morning (6-9 AM)', 'Morning (9-12 PM)', 'Afternoon (12-5 PM)', 
  'Evening (5-8 PM)', 'Night (8-11 PM)', 'Late Night (11 PM-6 AM)'
]

const FOCUS_AREAS = [
  'Mathematics', 'Science', 'Programming', 'Languages', 'History', 
  'Literature', 'Art & Design', 'Music', 'Business', 'Engineering'
]

const MOTIVATION_FACTORS = [
  'Career Advancement', 'Personal Interest', 'Academic Requirements', 
  'Skill Development', 'Certification Goals', 'Peer Competition', 
  'Creative Expression', 'Problem Solving'
]

export function LearningPreferencesComponent({ preferences, onUpdatePreferences }: LearningPreferencesProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LearningPreferencesData>({
    resolver: zodResolver(learningPreferencesSchema),
    defaultValues: {
      learningStyle: preferences.learningStyle || [],
      preferredContentTypes: preferences.preferredContentTypes || [],
      sessionDuration: preferences.sessionDuration || 45,
      difficultyPreference: preferences.difficultyPreference || DifficultyPreference.MODERATE,
      studySchedule: {
        preferredDays: preferences.studySchedule?.preferredDays || [],
        preferredTimeSlots: preferences.studySchedule?.preferredTimeSlots || [],
      },
      focusAreas: preferences.focusAreas || [],
      motivationFactors: preferences.motivationFactors || [],
    },
  })

  const handleSubmit = async (data: LearningPreferencesData) => {
    setIsLoading(true)
    try {
      await onUpdatePreferences(data)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleArrayValue = (fieldName: keyof LearningPreferencesData, value: string) => {
    const currentValues = form.getValues(fieldName) as string[]
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    form.setValue(fieldName, newValues as any)
  }

  const toggleNestedArrayValue = (parentField: string, childField: string, value: string) => {
    const currentValues = form.getValues(`${parentField}.${childField}` as any) as string[]
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    form.setValue(`${parentField}.${childField}` as any, newValues)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Learning Preferences</h1>
        <p className="text-muted-foreground">
          Customize your learning experience to match your style and goals
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Learning Styles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Learning Styles
            </CardTitle>
            <CardDescription>
              Select all learning styles that work best for you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.values(LearningStyle).map((style) => (
                <div
                  key={style}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    form.watch('learningStyle').includes(style)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleArrayValue('learningStyle', style)}
                >
                  <h4 className="font-medium capitalize">
                    {style.replace('_', ' ').toLowerCase()}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {style === LearningStyle.VISUAL && 'Learn through images, diagrams, and visual aids'}
                    {style === LearningStyle.AUDITORY && 'Learn through listening and verbal instruction'}
                    {style === LearningStyle.KINESTHETIC && 'Learn through movement and physical activity'}
                    {style === LearningStyle.READING_WRITING && 'Learn through reading and writing exercises'}
                    {style === LearningStyle.HANDS_ON && 'Learn through practical application and experimentation'}
                  </p>
                </div>
              ))}
            </div>
            {form.formState.errors.learningStyle && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.learningStyle.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Content Types */}
        <Card>
          <CardHeader>
            <CardTitle>Preferred Content Types</CardTitle>
            <CardDescription>
              Choose the types of content you prefer for learning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.values(ContentType).map((type) => (
                <Badge
                  key={type}
                  variant={form.watch('preferredContentTypes').includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer p-3 justify-center"
                  onClick={() => toggleArrayValue('preferredContentTypes', type)}
                >
                  {type.replace('_', ' ').toLowerCase()}
                </Badge>
              ))}
            </div>
            {form.formState.errors.preferredContentTypes && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.preferredContentTypes.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session Settings
            </CardTitle>
            <CardDescription>
              Configure your learning session preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sessionDuration">Preferred Session Duration (minutes)</Label>
                <Input
                  id="sessionDuration"
                  type="number"
                  min="5"
                  max="180"
                  {...form.register('sessionDuration', { valueAsNumber: true })}
                  data-testid="session-duration"
                />
                {form.formState.errors.sessionDuration && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.sessionDuration.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Difficulty Preference</Label>
                <Select 
                  value={form.watch('difficultyPreference')} 
                  onValueChange={(value) => form.setValue('difficultyPreference', value as DifficultyPreference)}
                >
                  <SelectTrigger data-testid="difficulty-preference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DifficultyPreference.GRADUAL}>
                      Gradual - Slow, steady progression
                    </SelectItem>
                    <SelectItem value={DifficultyPreference.MODERATE}>
                      Moderate - Balanced challenge level
                    </SelectItem>
                    <SelectItem value={DifficultyPreference.CHALLENGING}>
                      Challenging - Fast-paced, high difficulty
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Study Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Study Schedule</CardTitle>
            <CardDescription>
              Set your preferred study days and times
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-base font-medium">Preferred Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Badge
                    key={day}
                    variant={form.watch('studySchedule.preferredDays').includes(day) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleNestedArrayValue('studySchedule', 'preferredDays', day)}
                  >
                    {day}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium">Preferred Time Slots</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TIME_SLOTS.map((slot) => (
                  <Badge
                    key={slot}
                    variant={form.watch('studySchedule.preferredTimeSlots').includes(slot) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleNestedArrayValue('studySchedule', 'preferredTimeSlots', slot)}
                  >
                    {slot}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Focus Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Focus Areas
            </CardTitle>
            <CardDescription>
              Select the subjects you want to focus on
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => (
                <Badge
                  key={area}
                  variant={form.watch('focusAreas').includes(area) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue('focusAreas', area)}
                >
                  {area}
                </Badge>
              ))}
            </div>
            {form.formState.errors.focusAreas && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.focusAreas.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Motivation Factors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Motivation Factors
            </CardTitle>
            <CardDescription>
              What motivates you to learn? This helps us personalize your experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {MOTIVATION_FACTORS.map((factor) => (
                <Badge
                  key={factor}
                  variant={form.watch('motivationFactors').includes(factor) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleArrayValue('motivationFactors', factor)}
                >
                  {factor}
                </Badge>
              ))}
            </div>
            {form.formState.errors.motivationFactors && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.motivationFactors.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
          data-testid="save-learning-preferences"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Learning Preferences
        </Button>
      </form>
    </div>
  )
}