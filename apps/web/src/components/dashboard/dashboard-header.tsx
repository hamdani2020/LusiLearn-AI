"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react'

interface DashboardHeaderProps {
  userId: string
}

export function DashboardHeader({ userId }: DashboardHeaderProps) {
  // Mock data - in real app this would come from API
  const userData = {
    name: "Alex Johnson",
    educationLevel: "High School",
    currentStreak: 7,
    totalLearningTime: 45, // hours this month
    overallProgress: 68,
    activeGoals: 3
  }

  return (
    <div className="space-y-4">
      {/* Welcome Message */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {userData.name}! 👋
        </h1>
        <p className="text-muted-foreground">
          Ready to continue your learning journey? You're doing great!
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Learning Streak</p>
                <p className="text-2xl font-bold">{userData.currentStreak} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">This Month</p>
                <p className="text-2xl font-bold">{userData.totalLearningTime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Overall Progress</p>
                <div className="flex items-center space-x-2">
                  <Progress value={userData.overallProgress} className="flex-1" />
                  <span className="text-sm font-medium">{userData.overallProgress}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Active Goals</p>
                <p className="text-2xl font-bold">{userData.activeGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Education Level Badge */}
      <div className="flex items-center space-x-2">
        <Badge variant="secondary">{userData.educationLevel}</Badge>
        <span className="text-sm text-muted-foreground">
          Personalized content for your level
        </span>
      </div>
    </div>
  )
}