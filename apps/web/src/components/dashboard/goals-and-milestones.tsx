"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Target, Plus, Calendar, CheckCircle, Circle, Trophy } from 'lucide-react'

interface GoalsAndMilestonesProps {
  userId: string
}

export function GoalsAndMilestones({ userId }: GoalsAndMilestonesProps) {
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newGoal, setNewGoal] = useState('')

  // Mock goals data - in real app this would come from API
  const goals = [
    {
      id: '1',
      title: 'Complete JavaScript Fundamentals',
      description: 'Master all core JavaScript concepts',
      progress: 75,
      targetDate: '2024-03-15',
      status: 'in_progress',
      milestones: [
        { id: '1', title: 'Variables & Data Types', completed: true },
        { id: '2', title: 'Functions & Scope', completed: true },
        { id: '3', title: 'Objects & Arrays', completed: false },
        { id: '4', title: 'Async Programming', completed: false }
      ]
    },
    {
      id: '2',
      title: 'Build First React App',
      description: 'Create a complete React application',
      progress: 30,
      targetDate: '2024-04-01',
      status: 'in_progress',
      milestones: [
        { id: '1', title: 'Setup Development Environment', completed: true },
        { id: '2', title: 'Learn JSX Syntax', completed: true },
        { id: '3', title: 'Component Architecture', completed: false },
        { id: '4', title: 'State Management', completed: false },
        { id: '5', title: 'Deploy Application', completed: false }
      ]
    },
    {
      id: '3',
      title: 'Data Structures Mastery',
      description: 'Understand and implement key data structures',
      progress: 60,
      targetDate: '2024-03-30',
      status: 'in_progress',
      milestones: [
        { id: '1', title: 'Arrays & Linked Lists', completed: true },
        { id: '2', title: 'Stacks & Queues', completed: true },
        { id: '3', title: 'Trees & Graphs', completed: false },
        { id: '4', title: 'Hash Tables', completed: false }
      ]
    }
  ]

  const completedGoals = goals.filter(goal => goal.status === 'completed').length
  const totalGoals = goals.length

  const handleAddGoal = () => {
    if (newGoal.trim()) {
      // In real app, this would make an API call
      console.log('Adding goal:', newGoal)
      setNewGoal('')
      setShowAddGoal(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Goals & Milestones</span>
        </CardTitle>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setShowAddGoal(!showAddGoal)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Goals Overview */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-medium">Goals Progress</span>
          </div>
          <Badge variant="secondary">
            {completedGoals}/{totalGoals} completed
          </Badge>
        </div>

        {/* Add New Goal */}
        {showAddGoal && (
          <div className="space-y-2 p-3 border rounded-lg">
            <Input
              placeholder="Enter your learning goal..."
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
            />
            <div className="flex space-x-2">
              <Button size="sm" onClick={handleAddGoal}>Add Goal</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddGoal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Goals List */}
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface GoalCardProps {
  goal: {
    id: string
    title: string
    description: string
    progress: number
    targetDate: string
    status: string
    milestones: Array<{ id: string; title: string; completed: boolean }>
  }
}

function GoalCard({ goal }: GoalCardProps) {
  const completedMilestones = goal.milestones.filter(m => m.completed).length
  const totalMilestones = goal.milestones.length
  const daysUntilTarget = Math.ceil(
    (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Goal Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold">{goal.title}</h4>
          <p className="text-sm text-muted-foreground">{goal.description}</p>
        </div>
        <Badge variant={goal.status === 'completed' ? 'default' : 'secondary'}>
          {goal.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Progress: {completedMilestones}/{totalMilestones} milestones</span>
          <span className="flex items-center text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {daysUntilTarget > 0 ? `${daysUntilTarget} days left` : 'Overdue'}
          </span>
        </div>
        <Progress value={goal.progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{goal.progress}% complete</span>
          <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-1">
        <p className="text-sm font-medium">Milestones:</p>
        <div className="space-y-1">
          {goal.milestones.slice(0, 3).map((milestone) => (
            <div key={milestone.id} className="flex items-center space-x-2 text-sm">
              {milestone.completed ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={milestone.completed ? 'line-through text-muted-foreground' : ''}>
                {milestone.title}
              </span>
            </div>
          ))}
          {goal.milestones.length > 3 && (
            <p className="text-xs text-muted-foreground ml-5">
              +{goal.milestones.length - 3} more milestones
            </p>
          )}
        </div>
      </div>
    </div>
  )
}