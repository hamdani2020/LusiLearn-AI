'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Plus, Trash2 } from 'lucide-react'

// Simple date formatting function
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

interface GoalSettingProps {
  onNext: (data: any) => void
  onPrevious: () => void
}

interface Goal {
  id: string
  title: string
  description: string
  targetDate: Date
  priority: 'low' | 'medium' | 'high'
  progress: number
  isCompleted: boolean
}

export function GoalSetting({ onNext, onPrevious }: GoalSettingProps) {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: '1',
      title: 'Master Core Concepts',
      description: 'Build a strong foundation in the chosen subject area',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      priority: 'high',
      progress: 0,
      isCompleted: false
    }
  ])

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    priority: 'medium' as 'low' | 'medium' | 'high'
  })

  const addGoal = () => {
    if (newGoal.title.trim()) {
      const goal: Goal = {
        id: Date.now().toString(),
        title: newGoal.title,
        description: newGoal.description,
        targetDate: newGoal.targetDate,
        priority: newGoal.priority,
        progress: 0,
        isCompleted: false
      }
      setGoals([...goals, goal])
      setNewGoal({
        title: '',
        description: '',
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        priority: 'medium'
      })
    }
  }

  const removeGoal = (id: string) => {
    setGoals(goals.filter(goal => goal.id !== id))
  }

  const handleNext = () => {
    onNext(goals)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value)
    setNewGoal({ ...newGoal, targetDate: date })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Set Your Learning Goals
        </h2>
        <p className="text-gray-600">
          Define what you want to achieve in your learning journey
        </p>
      </div>

      <div className="space-y-6">
        {/* Current Goals */}
        <Card>
          <CardHeader>
            <CardTitle>Your Learning Goals</CardTitle>
            <CardDescription>
              Review and manage your learning objectives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{goal.title}</h3>
                    <p className="text-gray-600 text-sm">{goal.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>Target: {formatDate(goal.targetDate)}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        goal.priority === 'high' ? 'bg-red-100 text-red-800' :
                        goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {goal.priority.charAt(0).toUpperCase() + goal.priority.slice(1)} Priority
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGoal(goal.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Add New Goal */}
        <Card>
          <CardHeader>
            <CardTitle>Add New Goal</CardTitle>
            <CardDescription>
              Create additional learning objectives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title</Label>
              <Input
                id="goal-title"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="e.g., Master JavaScript Fundamentals"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Describe what you want to achieve..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={newGoal.targetDate.toISOString().split('T')[0]}
                  onChange={handleDateChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newGoal.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setNewGoal({ ...newGoal, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={addGoal} className="w-full" disabled={!newGoal.title.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Goal
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <Button variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button onClick={handleNext} disabled={goals.length === 0}>
          Next
        </Button>
      </div>
    </div>
  )
} 