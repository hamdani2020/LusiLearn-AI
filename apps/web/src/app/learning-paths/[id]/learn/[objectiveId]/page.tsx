"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MainNav } from '@/components/navigation/main-nav'
import { 
  ArrowLeft, 
  Play, 
  Pause,
  CheckCircle, 
  Clock,
  BookOpen,
  Video,
  FileText,
  ExternalLink,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'
import { useLearningPath } from '@/hooks/use-learning-data'
import { api } from '@/lib/api'

interface LearningSessionPageProps {
  params: { 
    id: string
    objectiveId: string 
  }
}

interface ContentItem {
  id: string
  title: string
  description: string
  url: string
  type: 'video' | 'article' | 'exercise' | 'quiz'
  duration: number
  difficulty: string
  source: string
}

export default function LearningSessionPage({ params }: LearningSessionPageProps) {
  const { id: pathId, objectiveId } = params
  const { data: pathData, isLoading: pathLoading } = useLearningPath(pathId)
  
  const [currentObjective, setCurrentObjective] = useState<any>(null)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [currentContentIndex, setCurrentContentIndex] = useState(0)
  const [sessionProgress, setSessionProgress] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date())
  const [isContentLoading, setIsContentLoading] = useState(true)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  // Find the current objective
  useEffect(() => {
    if (pathData?.data?.objectives) {
      const objective = pathData.data.objectives.find((obj: any) => obj.id === objectiveId)
      setCurrentObjective(objective)
    }
  }, [pathData, objectiveId])

  // Load content for the objective
  useEffect(() => {
    if (currentObjective) {
      loadContentForObjective(currentObjective)
    }
  }, [currentObjective])

  const loadContentForObjective = async (objective: any) => {
    setIsContentLoading(true)
    try {
      // Fetch content recommendations from API
      const response = await api.get(`/api/v1/content/recommendations/${objective.id}`)
      
      if (response.success && response.data) {
        console.log('Loaded content recommendations:', response.data)
        setContentItems(response.data)
      } else {
        // Fallback to mock content if API fails
        console.log('API failed, using fallback content')
        const mockContent = generateMockContent(objective)
        setContentItems(mockContent)
      }
    } catch (error) {
      console.error('Error loading content:', error)
      // Fallback to mock content
      const mockContent = generateMockContent(objective)
      setContentItems(mockContent)
    } finally {
      setIsContentLoading(false)
    }
  }

  const generateMockContent = (objective: any): ContentItem[] => {
    const baseContent = [
      {
        id: `${objective.id}-intro`,
        title: `Introduction to ${objective.title}`,
        description: `Get started with ${objective.title.toLowerCase()}`,
        url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`, // Placeholder
        type: 'video' as const,
        duration: 15,
        difficulty: objective.difficulty || 'beginner',
        source: 'YouTube'
      },
      {
        id: `${objective.id}-theory`,
        title: `${objective.title} - Theory and Concepts`,
        description: objective.description,
        url: `https://developer.mozilla.org/en-US/docs/Web/JavaScript`, // Placeholder
        type: 'article' as const,
        duration: 20,
        difficulty: objective.difficulty || 'beginner',
        source: 'MDN Web Docs'
      },
      {
        id: `${objective.id}-practice`,
        title: `Practice: ${objective.title}`,
        description: `Hands-on exercises for ${objective.title.toLowerCase()}`,
        url: `https://codepen.io/pen/`, // Placeholder
        type: 'exercise' as const,
        duration: 30,
        difficulty: objective.difficulty || 'beginner',
        source: 'CodePen'
      },
      {
        id: `${objective.id}-quiz`,
        title: `Quiz: ${objective.title}`,
        description: `Test your knowledge of ${objective.title.toLowerCase()}`,
        url: '#',
        type: 'quiz' as const,
        duration: 10,
        difficulty: objective.difficulty || 'beginner',
        source: 'LusiLearn'
      }
    ]

    return baseContent
  }

  const handleContentComplete = () => {
    const newProgress = Math.round(((currentContentIndex + 1) / contentItems.length) * 100)
    setSessionProgress(newProgress)
    
    if (currentContentIndex < contentItems.length - 1) {
      setCurrentContentIndex(currentContentIndex + 1)
    } else {
      // Session completed
      setSessionCompleted(true)
      handleSessionComplete()
    }
  }

  const handleSessionComplete = async () => {
    try {
      const sessionDuration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000)
      
      // Mark objective as completed via API
      const response = await api.post(`/api/v1/learning-paths/${pathId}/objectives/${objectiveId}/complete`, {
        sessionDuration,
        comprehensionScore: 85 // Mock score - in real app this would be calculated
      })

      if (response.success) {
        console.log('Objective completed successfully:', response.data)
      }
    } catch (error) {
      console.error('Error completing objective:', error)
    }
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />
      case 'article': return <FileText className="h-4 w-4" />
      case 'exercise': return <BookOpen className="h-4 w-4" />
      case 'quiz': return <CheckCircle className="h-4 w-4" />
      default: return <BookOpen className="h-4 w-4" />
    }
  }

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'video': return 'bg-red-100 text-red-800'
      case 'article': return 'bg-blue-100 text-blue-800'
      case 'exercise': return 'bg-green-100 text-green-800'
      case 'quiz': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (pathLoading || isContentLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentObjective) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Objective not found. Please try again.
              </p>
              <Button className="mt-4" asChild>
                <Link href={`/learning-paths/${pathId}`}>Back to Learning Path</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const currentContent = contentItems[currentContentIndex]

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/learning-paths/${pathId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Path
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{currentObjective.title}</h1>
              <p className="text-muted-foreground">{currentObjective.description}</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary">
            {currentContentIndex + 1} of {contentItems.length}
          </Badge>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Session Progress</span>
              <span className="text-sm text-muted-foreground">{sessionProgress}%</span>
            </div>
            <Progress value={sessionProgress} className="h-2" />
          </CardContent>
        </Card>

        {sessionCompleted ? (
          /* Session Complete */
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Objective Completed! 🎉</h2>
              <p className="text-muted-foreground mb-6">
                Great job! You've successfully completed "{currentObjective.title}".
              </p>
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link href={`/learning-paths/${pathId}`}>
                    Back to Learning Path
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => {
                  setSessionCompleted(false)
                  setCurrentContentIndex(0)
                  setSessionProgress(0)
                  setSessionStartTime(new Date())
                }}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Current Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getContentIcon(currentContent.type)}
                      <CardTitle>{currentContent.title}</CardTitle>
                    </div>
                    <Badge className={getContentTypeColor(currentContent.type)}>
                      {currentContent.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{currentContent.description}</p>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{currentContent.duration} min</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Badge variant="outline">{currentContent.difficulty}</Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span>Source: {currentContent.source}</span>
                    </div>
                  </div>

                  {/* Content Display */}
                  <div className="border rounded-lg p-6 bg-muted/50 min-h-[300px] flex items-center justify-center">
                    {currentContent.type === 'video' && (
                      <div className="text-center">
                        <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">Video content would be embedded here</p>
                        <Button variant="outline" asChild>
                          <a href={currentContent.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Watch on {currentContent.source}
                          </a>
                        </Button>
                      </div>
                    )}
                    
                    {currentContent.type === 'article' && (
                      <div className="text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">Article content would be displayed here</p>
                        <Button variant="outline" asChild>
                          <a href={currentContent.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Read on {currentContent.source}
                          </a>
                        </Button>
                      </div>
                    )}
                    
                    {currentContent.type === 'exercise' && (
                      <div className="text-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">Interactive exercise would be here</p>
                        <Button variant="outline" asChild>
                          <a href={currentContent.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Practice on {currentContent.source}
                          </a>
                        </Button>
                      </div>
                    )}
                    
                    {currentContent.type === 'quiz' && (
                      <div className="text-center">
                        <CheckCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">Quiz questions would be displayed here</p>
                        <div className="space-y-2">
                          <p className="font-medium">Sample Question: What is a variable in JavaScript?</p>
                          <div className="space-y-1">
                            <Button variant="outline" className="w-full justify-start">A) A container for storing data</Button>
                            <Button variant="outline" className="w-full justify-start">B) A type of function</Button>
                            <Button variant="outline" className="w-full justify-start">C) A CSS property</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button 
                      variant="outline" 
                      disabled={currentContentIndex === 0}
                      onClick={() => setCurrentContentIndex(Math.max(0, currentContentIndex - 1))}
                    >
                      Previous
                    </Button>
                    <Button onClick={handleContentComplete}>
                      {currentContentIndex === contentItems.length - 1 ? 'Complete Objective' : 'Next'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Content List */}
              <Card>
                <CardHeader>
                  <CardTitle>Learning Materials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contentItems.map((item, index) => (
                    <div 
                      key={item.id}
                      className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                        index === currentContentIndex 
                          ? 'bg-primary/10 border border-primary/20' 
                          : index < currentContentIndex 
                            ? 'bg-green-50 border border-green-200' 
                            : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setCurrentContentIndex(index)}
                    >
                      <div className="flex-shrink-0">
                        {index < currentContentIndex ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : index === currentContentIndex ? (
                          <Play className="h-4 w-4 text-primary" />
                        ) : (
                          getContentIcon(item.type)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.duration} min</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Objective Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Objective Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Difficulty:</span>
                    <Badge variant="outline">{currentObjective.difficulty}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Duration:</span>
                    <span className="text-sm">{Math.floor(currentObjective.estimatedDuration / 60)}h {currentObjective.estimatedDuration % 60}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Progress:</span>
                    <span className="text-sm">{sessionProgress}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}