"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  BookOpen,
  Users,
  Award,
  Clock,
  ExternalLink,
  Play
} from 'lucide-react'
import { useUserAchievements } from '@/hooks/use-progress-data'

interface RecentActivityProps {
  userId: string
}

export function RecentActivity({ userId }: RecentActivityProps) {
  const { data: achievementsData } = useUserAchievements()

  // Convert achievements to activity format
  const activities = (achievementsData?.data || []).slice(0, 6).map((achievement: any) => ({
    id: achievement.id,
    type: 'achievement',
    title: `Achievement Unlocked: "${achievement.title}"`,
    description: achievement.description,
    timestamp: formatTimeAgo(achievement.earnedAt),
    points: achievement.points,
    icon: Award,
    color: 'text-yellow-600'
  }))

  // Add some default activities if no achievements
  if (activities.length === 0) {
    activities.push({
      id: '1',
      type: 'welcome',
      title: 'Welcome to LusiLearn AI!',
      description: 'Start your learning journey by creating your first learning path',
      timestamp: 'Just now',
      icon: BookOpen,
      color: 'text-blue-600',
      points: undefined
    })
  }

  function formatTimeAgo(date: string | Date) {
    const now = new Date()
    const past = new Date(date)
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours} hours ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} days ago`
    return past.toLocaleDateString()
  }


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Recent Activity</h3>
            <p className="text-muted-foreground mb-4">
              Start learning to see your activity here.
            </p>
            <Button>Browse Content</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ActivityItemProps {
  activity: {
    id: string
    type: string
    title: string
    description: string
    timestamp: string
    score?: number
    duration?: string
    rating?: number
    source?: string
    progress?: number
    points?: number
    icon: any
    color: string
  }
}

function ActivityItem({ activity }: ActivityItemProps) {
  const getActivityBadge = () => {
    switch (activity.type) {
      case 'achievement':
        return <Badge className="bg-yellow-100 text-yellow-800">Achievement</Badge>
      case 'lesson_completed':
        return <Badge variant="secondary">Lesson</Badge>
      case 'milestone_achieved':
        return <Badge className="bg-yellow-100 text-yellow-800">Milestone</Badge>
      case 'peer_session':
        return <Badge className="bg-blue-100 text-blue-800">Collaboration</Badge>
      case 'assessment_completed':
        return <Badge className="bg-purple-100 text-purple-800">Assessment</Badge>
      case 'content_bookmarked':
        return <Badge variant="outline">Bookmarked</Badge>
      case 'goal_progress':
        return <Badge className="bg-green-100 text-green-800">Goal</Badge>
      case 'welcome':
        return <Badge className="bg-blue-100 text-blue-800">Welcome</Badge>
      default:
        return <Badge variant="secondary">Activity</Badge>
    }
  }

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`p-2 rounded-full bg-muted ${activity.color}`}>
        <activity.icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1">
          <h4 className="font-medium text-sm leading-tight">{activity.title}</h4>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
            {activity.timestamp}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>

        <div className="flex items-center space-x-2 text-xs">
          {getActivityBadge()}

          {activity.score && (
            <Badge variant="outline" className="text-xs">
              Score: {activity.score}%
            </Badge>
          )}

          {activity.duration && (
            <div className="flex items-center text-muted-foreground">
              <Clock className="h-3 w-3 mr-1" />
              {activity.duration}
            </div>
          )}

          {activity.rating && (
            <div className="flex items-center text-muted-foreground">
              {'★'.repeat(activity.rating)}
            </div>
          )}

          {activity.source && (
            <div className="flex items-center text-muted-foreground">
              <ExternalLink className="h-3 w-3 mr-1" />
              {activity.source}
            </div>
          )}

          {activity.progress && (
            <Badge variant="outline" className="text-xs">
              {activity.progress}% complete
            </Badge>
          )}

          {activity.points && (
            <Badge variant="outline" className="text-xs">
              +{activity.points} points
            </Badge>
          )}
        </div>
      </div>

      {(activity.type === 'lesson_completed' || activity.type === 'content_bookmarked') && (
        <Button size="sm" variant="ghost" className="p-1 h-auto">
          <Play className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}