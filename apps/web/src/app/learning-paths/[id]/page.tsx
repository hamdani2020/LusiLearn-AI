"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MainNav } from '@/components/navigation/main-nav'
import { useLearningPath } from '@/hooks/use-learning-data'
import { ProgressTracking } from '@/components/learning/progress-tracking'
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Circle, 
  Clock,
  Target,
  BookOpen
} from 'lucide-react'
import Link from 'next/link'

interface LearningPathPageProps {
  params: { id: string }
}

export default function LearningPathPage({ params }: LearningPathPageProps) {
  const { id } = params
  const { data: pathData, isLoading, error } = useLearningPath(id)

  // Mock data for demonstration
  const mockPath = {
    id: id,
    subject: "JavaScript Fundamentals",
    currentLevel: "intermediate",
    progress: { 
      overallProgress: 75, 
      currentMilestone: "Functions & Scope",
      completedObjectives: ["obj-1", "obj-2"],
      estimatedCompletion: "2024-03-15"
    },
    objectives: [
      { 
        id: "obj-1", 
        title: "Variables & Data Types", 
        description: "Learn about different data types and variable declarations",
        difficulty: "beginner" as const,
        estimatedDuration: 120,
        completed: true 
      },
      { 
        id: "obj-2", 
        title: "Functions & Scope", 
        description: "Master function declarations, expressions, and scope concepts",
        difficulty: "intermediate" as const,
        estimatedDuration: 180,
        completed: true 
      },
      { 
        id: "obj-3", 
        title: "Objects & Arrays", 
        description: "Work with complex data structures and their methods",
        difficulty: "intermediate" as const,
        estimatedDuration: 150,
        completed: false 
      },
      { 
        id: "obj-4", 
        title: "Async Programming", 
        description: "Understand promises, async/await, and asynchronous patterns",
        difficulty: "advanced" as const,
        estimatedDuration: 200,
        completed: false 
      }
    ]
  }

  const path = pathData?.data || mockPath

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Unable to load learning path. Please try again later.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const completedObjectives = (path.objectives || []).filter((obj: any) => obj.completed).length
  const totalObjectives = path.objectives?.length || 0
  const nextObjective = (path.objectives || []).find((obj: any) => !obj.completed)

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {/* Path Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{path.subject}</CardTitle>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge>{path.currentLevel}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {completedObjectives}/{totalObjectives} objectives completed
                  </span>
                </div>
              </div>
              {nextObjective && (
                <Button className="flex items-center space-x-2" asChild>
                  <Link href={`/learning-paths/${path.id}/learn/${nextObjective.id}`}>
                    <Play className="h-4 w-4" />
                    <span>Continue Learning</span>
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{path.progress.overallProgress}%</span>
              </div>
              <Progress value={path.progress.overallProgress} className="h-3" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-primary" />
                <span>Current: {path.progress?.currentMilestone || 'Getting started'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>Est. completion: {path.progress?.estimatedCompletion ? new Date(path.progress.estimatedCompletion).toLocaleDateString() : 'TBD'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Next: {nextObjective?.title || 'No objectives yet'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Objectives */}
        <Card>
          <CardHeader>
            <CardTitle>Learning Objectives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(path.objectives || []).length > 0 ? (
              (path.objectives || []).map((objective: any, index: number) => (
                <ObjectiveCard 
                  key={objective.id} 
                  objective={objective} 
                  index={index}
                  isNext={!objective.completed && objective.id === nextObjective?.id}
                  pathId={path.id}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  <BookOpen className="h-12 w-12 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Learning Objectives Yet</h3>
                  <p className="text-sm">
                    Your learning path is being generated. This may take a few moments.
                  </p>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Tracking */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressTracking 
                pathId={path.id}
                onMilestoneComplete={(milestoneId) => {
                  console.log('Milestone completed:', milestoneId)
                  // Refresh the learning path data
                  window.location.reload()
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

interface ObjectiveCardProps {
  objective: {
    id: string
    title: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    estimatedDuration: number
    completed: boolean
  }
  index: number
  isNext: boolean
}

function ObjectiveCard({ objective, index, isNext, pathId }: ObjectiveCardProps & { pathId: string }) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className={`border rounded-lg p-4 ${isNext ? 'ring-2 ring-primary' : ''} ${objective.completed ? 'bg-muted/50' : ''}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-1">
          {objective.completed ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className={`font-semibold ${objective.completed ? 'line-through text-muted-foreground' : ''}`}>
                {index + 1}. {objective.title}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {objective.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              <Badge className={getDifficultyColor(objective.difficulty)}>
                {objective.difficulty}
              </Badge>
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {Math.floor(objective.estimatedDuration / 60)}h {objective.estimatedDuration % 60}m
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex gap-2">
            {!objective.completed && (
              <Button size="sm" className="flex items-center space-x-2" asChild>
                <Link href={`/learning-paths/${pathId}/learn/${objective.id}`}>
                  <Play className="h-3 w-3" />
                  <span>{isNext ? 'Start Learning' : 'Learn'}</span>
                </Link>
              </Button>
            )}
            {objective.completed && (
              <Button size="sm" variant="outline" className="flex items-center space-x-2" asChild>
                <Link href={`/learning-paths/${pathId}/learn/${objective.id}`}>
                  <CheckCircle className="h-3 w-3" />
                  <span>Review</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}