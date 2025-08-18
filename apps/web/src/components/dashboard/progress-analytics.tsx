"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BarChart, LineChart, ChartContainer } from '@/components/ui/chart'
import { TrendingUp, Clock, Target, Award } from 'lucide-react'
import { useProgressAnalytics, useProgressDashboard } from '@/hooks/use-progress-data'

interface ProgressAnalyticsProps {
  userId: string
}

interface SubjectProgress {
  name: string
  value: number
  color?: string
}

interface LearningInsight {
  type: string
  title: string
  description: string
  icon: any
}

export function ProgressAnalytics({ userId }: ProgressAnalyticsProps) {
  const { data: weeklyData } = useProgressAnalytics('weekly')
  const { data: monthlyData } = useProgressAnalytics('monthly')
  const { data: dashboardData } = useProgressDashboard()

  // Extract data with fallbacks
  const weeklyAnalytics = weeklyData?.data
  const monthlyAnalytics = monthlyData?.data
  const dashboard = dashboardData?.data

  const analyticsData = {
    weeklyProgress: weeklyAnalytics?.dailyHours || [
      { name: 'Mon', value: 0 },
      { name: 'Tue', value: 0 },
      { name: 'Wed', value: 0 },
      { name: 'Thu', value: 0 },
      { name: 'Fri', value: 0 },
      { name: 'Sat', value: 0 },
      { name: 'Sun', value: 0 }
    ],
    subjectProgress: (weeklyAnalytics?.subjectProgress || []) as SubjectProgress[],
    monthlyStats: {
      totalHours: monthlyAnalytics?.totalHours || 0,
      completedLessons: monthlyAnalytics?.completedSessions || 0,
      averageScore: monthlyAnalytics?.averageScore || 0,
      streak: dashboard?.weeklyAnalytics?.currentStreak || 0
    },
    learningInsights: (dashboard?.insights || [
      {
        type: 'info',
        title: 'Start Your Learning Journey',
        description: 'Complete your first learning session to see personalized insights',
        icon: TrendingUp
      }
    ]) as LearningInsight[]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Progress Analytics</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subjects">By Subject</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Weekly Learning Hours */}
            <div>
              <h4 className="text-sm font-medium mb-3">Weekly Learning Hours</h4>
              <ChartContainer className="h-48">
                <LineChart data={analyticsData.weeklyProgress} />
              </ChartContainer>
            </div>

            {/* Monthly Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <Clock className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{analyticsData.monthlyStats.totalHours}</p>
                <p className="text-xs text-muted-foreground">Hours This Month</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Target className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{analyticsData.monthlyStats.completedLessons}</p>
                <p className="text-xs text-muted-foreground">Lessons Completed</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Award className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{analyticsData.monthlyStats.averageScore}%</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{analyticsData.monthlyStats.streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subjects" className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">Progress by Subject</h4>
              <ChartContainer className="h-48">
                <BarChart data={analyticsData.subjectProgress} />
              </ChartContainer>
            </div>

            <div className="space-y-2">
              {analyticsData.subjectProgress.map((subject: SubjectProgress, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                  <span className="font-medium">{subject.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${subject.color || 'bg-primary'}`}
                        style={{ width: `${subject.value}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{subject.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="space-y-3">
              {analyticsData.learningInsights.map((insight: LearningInsight, index: number) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted">
                  <insight.icon className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h5 className="font-medium">{insight.title}</h5>
                      <Badge
                        variant={insight.type === 'strength' ? 'default' :
                          insight.type === 'improvement' ? 'secondary' : 'outline'}
                      >
                        {insight.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}