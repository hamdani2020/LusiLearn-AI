"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MainNav } from '@/components/navigation/main-nav'
import { useLearningPaths } from '@/hooks/use-learning-data'
import { 
  Plus, 
  Play, 
  Clock,
  Target,
  BookOpen,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function LearningPathsPage() {
  // For now, use a default user ID. In a real app, this would come from auth context
  const userId = "default-user"
  const { data: pathsData, isLoading, error } = useLearningPaths(userId)

  // Mock data for demonstration
  const mockPaths = [
    {
      id: "path-1",
      subject: "JavaScript Fundamentals",
      currentLevel: "intermediate",
      progress: { 
        overallProgress: 75, 
        currentMilestone: "Functions & Scope",
        completedObjectives: ["obj-1", "obj-2"],
        estimatedCompletion: "2024-03-15"
      },
      objectives: [
        { id: "obj-1", title: "Variables & Data Types", completed: true },
        { id: "obj-2", title: "Functions & Scope", completed: true },
        { id: "obj-3", title: "Objects & Arrays", completed: false },
        { id: "obj-4", title: "Async Programming", completed: false }
      ]
    },
    {
      id: "path-2", 
      subject: "Python for Data Science",
      currentLevel: "beginner",
      progress: { 
        overallProgress: 25, 
        currentMilestone: "Basic Syntax",
        completedObjectives: ["obj-1"],
        estimatedCompletion: "2024-04-20"
      },
      objectives: [
        { id: "obj-1", title: "Basic Syntax", completed: true },
        { id: "obj-2", title: "Data Structures", completed: false },
        { id: "obj-3", title: "Pandas & NumPy", completed: false },
        { id: "obj-4", title: "Data Visualization", completed: false }
      ]
    }
  ]

  const paths = pathsData?.data || mockPaths

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                Unable to load learning paths. Please try again later.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Paths</h1>
            <p className="text-muted-foreground">
              Your personalized learning journeys
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard">
              <Plus className="h-4 w-4 mr-2" />
              Create New Path
            </Link>
          </Button>
        </div>

        {/* Learning Paths Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {paths.map((path: any) => {
            const completedObjectives = (path.objectives || []).filter((obj: any) => obj.completed).length
            const totalObjectives = path.objectives?.length || 0
            const progressPercentage = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0

            return (
              <Card key={path.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{path.subject}</CardTitle>
                    <Badge variant="secondary">{path.currentLevel}</Badge>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{completedObjectives} of {totalObjectives} objectives completed</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progressPercentage)}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>

                  {/* Current Milestone */}
                  <div className="flex items-center space-x-2 text-sm">
                    <Target className="h-4 w-4 text-primary" />
                    <span>Current: {path.progress?.currentMilestone || 'Getting started'}</span>
                  </div>

                  {/* Estimated Completion */}
                  <div className="flex items-center space-x-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Est. completion: {path.progress?.estimatedCompletion ? new Date(path.progress.estimatedCompletion).toLocaleDateString() : 'TBD'}</span>
                  </div>

                  {/* Continue Button */}
                  <Button className="w-full" asChild>
                    <Link href={`/learning-paths/${path.id}`}>
                      <Play className="h-4 w-4 mr-2" />
                      Continue Learning
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Empty State */}
        {paths.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Learning Paths Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first learning path to get started with personalized learning.
              </p>
              <Button asChild>
                <Link href="/dashboard">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Learning Path
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 