"use client"

import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { LearningPathsOverview } from '@/components/dashboard/learning-paths-overview'
import { ProgressAnalytics } from '@/components/dashboard/progress-analytics'
import { GoalsAndMilestones } from '@/components/dashboard/goals-and-milestones'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Home, ArrowLeft } from 'lucide-react'

// Mock user ID - in real app this would come from auth context
const MOCK_USER_ID = "user-123"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-6 w-6 bg-primary rounded"></div>
            <span className="font-bold">LusiLearn AI</span>
          </Link>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Dashboard Header */}
      <Suspense fallback={<DashboardHeaderSkeleton />}>
        <DashboardHeader userId={MOCK_USER_ID} />
      </Suspense>

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Learning Paths and Progress */}
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<LearningPathsSkeleton />}>
            <LearningPathsOverview userId={MOCK_USER_ID} />
          </Suspense>
          
          <Suspense fallback={<ProgressAnalyticsSkeleton />}>
            <ProgressAnalytics userId={MOCK_USER_ID} />
          </Suspense>
        </div>

        {/* Right Column - Goals and Activity */}
        <div className="space-y-6">
          <Suspense fallback={<GoalsSkeleton />}>
            <GoalsAndMilestones userId={MOCK_USER_ID} />
          </Suspense>
          
          <Suspense fallback={<ActivitySkeleton />}>
            <RecentActivity userId={MOCK_USER_ID} />
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