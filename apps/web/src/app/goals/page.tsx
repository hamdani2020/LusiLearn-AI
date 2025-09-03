"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MainNav } from '@/components/navigation/main-nav'
import { useGoals, useDeleteGoal } from '@/hooks/use-learning-data'
import { Goal } from '@/lib/api-extended'
import { 
  Plus, 
  Target,
  Calendar,
  TrendingUp,
  CheckCircle,
  Circle,
  Clock,
  Edit,
  Trash2
} from 'lucide-react'

interface Milestone {
  id: string
  title: string
  completed: boolean
  dueDate: string
}

export default function GoalsPage() {
  const { data: goalsData, isLoading, error } = useGoals()
  const deleteGoalMutation = useDeleteGoal()
  const [showAddGoal, setShowAddGoal] = useState(false)

  const goals = (goalsData?.data ?? []) as Goal[]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return '🎓'
      case 'career': return '💼'
      case 'personal': return '🌟'
      case 'skill': return '⚡'
      default: return '🎯'
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      try {
        await deleteGoalMutation.mutateAsync(goalId)
        alert('Goal deleted successfully!')
      } catch (error) {
        alert('Failed to delete goal. Please try again.')
      }
    }
  }

  const completedGoals = goals.filter(goal => goal.status === 'completed').length
  const activeGoals = goals.filter(goal => goal.status === 'active').length
  const overdueGoals = goals.filter(goal => goal.status === 'overdue').length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
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
                Unable to load goals. Please try again later.
              </p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
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
            <h1 className="text-3xl font-bold tracking-tight">Learning Goals</h1>
            <p className="text-muted-foreground">
              Set, track, and achieve your learning objectives
            </p>
          </div>
          <Button onClick={() => setShowAddGoal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Goals</p>
                  <p className="text-2xl font-bold">{goals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{activeGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold">{overdueGoals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Goals Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getCategoryIcon(goal.category)}</span>
                    <div>
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                      <Badge className={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteGoal(goal.id)}
                      disabled={deleteGoalMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{goal.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                {/* Target Date */}
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
                </div>

                {/* Milestones */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Milestones</h4>
                  <div className="space-y-1">
                    {goal.milestones.slice(0, 3).map((milestone) => (
                      <div key={milestone.id} className="flex items-center space-x-2 text-sm">
                        {milestone.completed ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={milestone.completed ? "line-through text-muted-foreground" : ""}>
                          {milestone.title}
                        </span>
                      </div>
                    ))}
                    {goal.milestones.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{goal.milestones.length - 3} more milestones
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button size="sm" className="flex-1">
                    Update Progress
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {goals.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Goals</h3>
              <p className="text-muted-foreground mb-6">
                Goals feature coming soon!
              </p>
              {/* <Button onClick={() => setShowAddGoal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Goal
              </Button> */}
            </CardContent>
          </Card>
        )}

        {/* Add Goal Modal Placeholder */}
        {showAddGoal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Add New Goal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Goal creation functionality will be implemented here.
                </p>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setShowAddGoal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowAddGoal(false)}>
                    Create Goal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
} 