'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { ArrowRight, ArrowLeft, Brain, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { useOnboarding, SkillAssessmentQuestion, SkillAssessmentResult } from '@/hooks/use-onboarding'

interface SkillAssessmentProps {
  onNext: (data?: any) => void
  onPrevious: () => void
}

type AssessmentState = 'intro' | 'loading' | 'questions' | 'evaluating' | 'results'

export function SkillAssessment({ onNext, onPrevious }: SkillAssessmentProps) {
  const [state, setState] = useState<AssessmentState>('intro')
  const [questions, setQuestions] = useState<SkillAssessmentQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [results, setResults] = useState<SkillAssessmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    generateSkillAssessmentQuestions, 
    evaluateSkillAssessment,
    isLoading: hookLoading 
  } = useOnboarding()

  const startAssessment = async () => {
    try {
      setLoading(true)
      setError(null)
      setState('loading')
      
      console.log('🎯 Starting skill assessment...')
      const assessmentData = await generateSkillAssessmentQuestions()
      
      console.log('📝 Generated questions:', assessmentData)
      setQuestions(assessmentData.questions)
      setState('questions')
    } catch (err: any) {
      console.error('❌ Error starting assessment:', err)
      setError(err.message || 'Failed to start assessment')
      setState('intro')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      submitAssessment()
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const submitAssessment = async () => {
    try {
      setLoading(true)
      setError(null)
      setState('evaluating')
      
      console.log('📊 Submitting assessment answers:', answers)
      const assessmentResults = await evaluateSkillAssessment(answers)
      
      console.log('📈 Assessment results:', assessmentResults)
      setResults(assessmentResults)
      setState('results')
    } catch (err: any) {
      console.error('❌ Error evaluating assessment:', err)
      setError(err.message || 'Failed to evaluate assessment')
      setState('questions')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (results) {
      onNext(results)
    }
  }

  const renderIntro = () => (
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
        <Button onClick={startAssessment} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              Start Assessment
              <ArrowRight className="ml-2 w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )

  const renderLoading = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Assessment</h2>
        <p className="text-gray-600">
          Our AI is creating personalized questions based on your profile...
        </p>
      </div>
    </div>
  )

  const renderQuestion = () => {
    if (questions.length === 0) return null
    
    const question = questions[currentQuestionIndex]
    const currentAnswer = answers[question.id]
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100

    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{question.question}</CardTitle>
            <CardDescription>
              {question.category} • {question.difficulty} level
            </CardDescription>
          </CardHeader>
          <CardContent>
            {question.type === 'multiple_choice' && question.options && (
              <RadioGroup 
                value={currentAnswer} 
                onValueChange={(value) => handleAnswer(question.id, value)}
              >
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                    <Label htmlFor={`${question.id}-${index}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.type === 'true_false' && (
              <RadioGroup 
                value={currentAnswer} 
                onValueChange={(value) => handleAnswer(question.id, value === 'true')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id={`${question.id}-true`} />
                  <Label htmlFor={`${question.id}-true`}>True</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id={`${question.id}-false`} />
                  <Label htmlFor={`${question.id}-false`}>False</Label>
                </div>
              </RadioGroup>
            )}

            {question.type === 'rating' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Not comfortable</span>
                  <span className="text-sm text-gray-600">Very comfortable</span>
                </div>
                <Slider
                  value={[currentAnswer || 3]}
                  onValueChange={(value) => handleAnswer(question.id, value[0])}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            )}

            {question.type === 'text' && (
              <Textarea
                placeholder="Please describe your experience..."
                value={currentAnswer || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                className="min-h-[100px]"
              />
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Previous
          </Button>
          
          <Button 
            onClick={handleNextQuestion}
            disabled={!currentAnswer}
          >
            {currentQuestionIndex === questions.length - 1 ? (
              <>
                Submit Assessment
                <CheckCircle className="ml-2 w-4 h-4" />
              </>
            ) : (
              <>
                Next Question
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  const renderEvaluating = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Your Results</h2>
        <p className="text-gray-600">
          Our AI is analyzing your responses to create personalized recommendations...
        </p>
      </div>
    </div>
  )

  const renderResults = () => {
    if (!results) return null

    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Assessment Complete!</h2>
          <p className="text-lg text-gray-600">
            Here's what we learned about your skills
          </p>
        </div>

        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {results.overallScore}%
                </div>
                <div className="text-lg text-gray-600 mb-4">
                  Recommended Level: <span className="font-semibold capitalize">{results.recommendedLevel}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${results.overallScore}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strengths */}
          {results.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Your Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.strengths.map((strength, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Areas for Improvement */}
          {results.areasForImprovement.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Areas for Improvement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.areasForImprovement.map((area, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Scores */}
          {Object.keys(results.categoryScores).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Subject Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.categoryScores).map(([category, score]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="capitalize font-medium">{category}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${score}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-8">{Math.round(score)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 text-center">
          <Button onClick={handleContinue} size="lg">
            Continue to Learning Preferences
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  const renderError = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="text-red-500 mb-4">
          <Brain className="w-12 h-12 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={startAssessment} variant="outline">
          Try Again
        </Button>
      </div>
    </div>
  )

  if (error && state !== 'intro') {
    return renderError()
  }

  switch (state) {
    case 'intro':
      return renderIntro()
    case 'loading':
      return renderLoading()
    case 'questions':
      return renderQuestion()
    case 'evaluating':
      return renderEvaluating()
    case 'results':
      return renderResults()
    default:
      return renderIntro()
  }
} 