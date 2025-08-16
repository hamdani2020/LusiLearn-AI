"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { BarChart, LineChart, ChartContainer } from '@/components/ui/chart'
import { TrendingUp, Clock, Target, Award } from 'lucide-react'

interface ProgressAnalyticsProps {
  userId: string
}

export function ProgressAnalytics({ userId }: ProgressAnalyticsProps) {
  // Mock analytics data - in real app this would come from API
  const analyticsData = {
    weeklyProgress: [
      { name: 'Mon', value: 2.5 },
      { name: 'Tue', value: 1.8 },
      { name: 'Wed', value: 3.2 },
      { name: 'Thu', value: 2.1 },
      { name: 'Fri', value: 4.0 },
      { name: 'Sat', value: 1.5 },
      { name: 'Sun', value: 2.8 }
    ],
    subjectProgress: [
      { name: 'JavaScript', value: 85, color: 'bg-blue-500' },
      { name: 'React', value: 60, color: 'bg-green-500' },
      { name: 'Data Structures', value: 45, color: 'bg-purple-500' },
      { name: 'Algorithms', value: 30, color: 'bg-orange-500' }
    ],
    monthlyStats: {
      totalHours: 45,
      completedLessons: 23,
      averageScore: 87,
      streak: 7
    },
    learningInsights: [
      {
        type: 'strength',
        title: 'Strong in Problem Solving',
        description: 'You excel at algorithmic thinking and debugging',
        icon: Award
      },
      {
        type: 'improvement',
        title: 'Focus on Consistency',
        description: 'Try to maintain daily learning sessions for better retention',
        icon: Target
      },
      {
        type: 'recommendation',
        title: 'Ready for Advanced Topics',
        description: 'Your JavaScript skills are strong enough for React patterns',
        icon: TrendingUp
      }
    ]
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
              {analyticsData.subjectProgress.map((subject, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                  <span className="font-medium">{subject.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${subject.color}`}
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
              {analyticsData.learningInsights.map((insight, index) => (
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