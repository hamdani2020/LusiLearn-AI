"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useLearningPaths } from '@/hooks/use-learning-data'
import { BookOpen, Clock, Play, Plus } from 'lucide-react'
import Link from 'next/link'

interface LearningPathsOverviewProps {
  userId: string
}

export function LearningPathsOverview({ userId }: LearningPathsOverviewProps) {
  const { data: learningPathsData, isLoading, error } = useLearningPaths(userId)

  const paths = learningPathsData?.data || []

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Unable to load learning paths. Please try again later.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5" />
          <span>Your Learning Paths</span>
        </CardTitle>
        <Button size="sm" className="flex items-center space-x-1">
          <Plus className="h-4 w-4" />
          <span>New Path</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : paths.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Learning Paths Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first learning path to get started with personalized learning.
            </p>
            <Button>Create Learning Path</Button>
          </div>
        ) : (
          paths.map((path) => (
            <LearningPathCard key={path.id} path={path} />
          ))
        )}
      </CardContent>
    </Card>
  )
}

interface LearningPathCardProps {
  path: {
    id: string
    subject: string
    currentLevel: string
    progress: { overallProgress: number; currentMilestone: string }
    objectives: Array<{ id: string; title: string; completed: boolean }>
    estimatedTimeLeft?: string
  }
}

function LearningPathCard({ path }: LearningPathCardProps) {
  const completedObjectives = path.objectives.filter(obj => obj.completed).length
  const totalObjectives = path.objectives.length

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold">{path.subject}</h3>
            <Badge className={getLevelColor(path.currentLevel)}>
              {path.currentLevel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {path.progress.currentMilestone}
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href={`/learning-paths/${path.id}`}>
            <Button size="sm" variant="outline">
              <Play className="h-4 w-4 mr-1" />
              Continue
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Progress: {completedObjectives}/{totalObjectives} objectives</span>
          <span className="flex items-center text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {path.estimatedTimeLeft || 'N/A'} left
          </span>
        </div>
        <Progress value={path.progress.overallProgress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{path.progress.overallProgress}% complete</span>
          <span>Next: {path.objectives.find(obj => !obj.completed)?.title || 'Complete!'}</span>
        </div>
      </div>
    </div>
  )
}