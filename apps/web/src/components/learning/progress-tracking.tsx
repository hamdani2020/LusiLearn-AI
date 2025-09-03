"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  useProgressDashboard, 
  useLearningStreaks, 
  useSkillProgress,
  useTrackMilestone 
} from '@/hooks/use-learning-data'
import { 
  TrendingUp, 
  Target, 
  Trophy, 
  Flame, 
  Brain,
  Clock,
  Star,
  Award
} from 'lucide-react'

interface ProgressTrackingProps {
  pathId?: string
  onMilestoneComplete?: (milestoneId: string) => void
}

export function ProgressTracking({ pathId, onMilestoneComplete }: ProgressTrackingProps) {
  const { data: dashboardData, isLoading: dashboardLoading } = useProgressDashboard()
  const { data: streaksData, isLoading: streaksLoading } = useLearningStreaks()
  const { data: skillsData, isLoading: skillsLoading } = useSkillProgress()
  const trackMilestoneMutation = useTrackMilestone()

  const [selectedTimeframe, setSelectedTimeframe] = useState<'weekly' | 'monthly'>('weekly')

  const handleMilestoneComplete = async (milestoneId: string) => {
    if (!pathId) return

    try {
      await trackMilestoneMutation.mutateAsync({ pathId, milestoneId })
      onMilestoneComplete?.(milestoneId)
    } catch (error) {
      console.error('Failed to track milestone:', error)
    }
  }

  if (dashboardLoading || streaksLoading || skillsLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  const dashboard = dashboardData?.data
  const streaks = streaksData?.data
  const skills = skillsData?.data || []

  // Helper function to safely get analytics data
  const getAnalyticsData = (timeframe: 'weekly' | 'monthly') => {
    if (!dashboard) return null
    return timeframe === 'weekly' ? (dashboard as any).weeklyAnalytics : (dashboard as any).monthlyAnalytics
  }

  const weeklyAnalytics = getAnalyticsData('weekly')
  const monthlyAnalytics = getAnalyticsData('monthly')

  return (
    <div className="space-y-6">
      {/* Learning Streaks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Learning Streaks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">
                {streaks?.currentStreak || 0}
              </div>
              <div className="text-sm text-muted-foreground">Current Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {streaks?.longestStreak || 0}
              </div>
              <div className="text-sm text-muted-foreground">Longest Streak</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Learning Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Timeframe Selector */}
            <div className="flex gap-2">
              <Button
                variant={selectedTimeframe === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeframe('weekly')}
              >
                Weekly
              </Button>
              <Button
                variant={selectedTimeframe === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeframe('monthly')}
              >
                Monthly
              </Button>
            </div>

            {/* Analytics Data */}
            {dashboard ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {selectedTimeframe === 'weekly' 
                      ? Math.round((weeklyAnalytics?.totalTimeSpent || 0) / 60)
                      : Math.round((monthlyAnalytics?.totalTimeSpent || 0) / 60)
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Minutes Spent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {selectedTimeframe === 'weekly'
                      ? weeklyAnalytics?.completedSessions || 0
                      : monthlyAnalytics?.completedSessions || 0
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">Sessions Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {selectedTimeframe === 'weekly'
                      ? (weeklyAnalytics?.averageScore || 0).toFixed(1)
                      : (monthlyAnalytics?.averageScore || 0).toFixed(1)
                    }%
                  </div>
                  <div className="text-sm text-muted-foreground">Average Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {dashboard.totalAchievements || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Achievements</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No analytics data available yet. Start learning to see your progress!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Recent Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard?.recentAchievements && dashboard.recentAchievements.length > 0 ? (
            <div className="space-y-3">
              {dashboard.recentAchievements.map((achievement) => (
                <div key={achievement.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div className="flex-1">
                    <div className="font-medium">{achievement.title}</div>
                    <div className="text-sm text-muted-foreground">{achievement.description}</div>
                  </div>
                  <Badge variant="secondary">{achievement.points} pts</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No achievements yet. Keep learning to earn badges!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Skill Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skills.length > 0 ? (
            <div className="space-y-4">
              {skills.slice(0, 5).map((skill) => (
                <div key={skill.skill} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{skill.skill}</span>
                    <span className="text-sm text-muted-foreground">
                      Level {skill.level}
                    </span>
                  </div>
                  <Progress value={skill.progress} className="h-2" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{skill.sessionsCompleted} sessions</span>
                    <span>Last: {new Date(skill.lastPracticed).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No skill progress data available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 