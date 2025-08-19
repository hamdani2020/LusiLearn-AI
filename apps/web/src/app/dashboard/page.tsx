'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MainNav } from '@/components/navigation/main-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { LearningPathsOverview } from '@/components/dashboard/learning-paths-overview'
import { ProgressAnalytics } from '@/components/dashboard/progress-analytics'
import { GoalsAndMilestones } from '@/components/dashboard/goals-and-milestones'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Home, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to access your dashboard</p>
          <a href="/auth/login" className="text-primary hover:underline">Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Use the same MainNav as content discovery */}
      <MainNav />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Dashboard Header */}
        <Suspense fallback={<DashboardHeaderSkeleton />}>
          <DashboardHeader userId={user.id} />
        </Suspense>

        {/* Quick Actions */}
        <QuickActions />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Learning Paths and Progress */}
          <div className="lg:col-span-2 space-y-6">
            <Suspense fallback={<LearningPathsSkeleton />}>
              <LearningPathsOverview userId={user.id} />
            </Suspense>
            
            <Suspense fallback={<ProgressAnalyticsSkeleton />}>
              <ProgressAnalytics userId={user.id} />
            </Suspense>
          </div>

          {/* Right Column - Goals and Activity */}
          <div className="space-y-6">
            <Suspense fallback={<GoalsSkeleton />}>
              <GoalsAndMilestones userId={user.id} />
            </Suspense>
            
            <Suspense fallback={<ActivitySkeleton />}>
              <RecentActivity userId={user.id} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )

}

// Loading skeletons
function DashboardHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  )
}

function LearningPathsSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressAnalyticsSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </CardContent>
    </Card>
  )
}

function GoalsSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}