'use client'

import { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, TrendingUp, Users, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentCard } from './content-card'
import { ContentRecommendation } from '@/types'

interface ContentRecommendationsProps {
  recommendations: ContentRecommendation[]
  isLoading?: boolean
  onRefresh?: () => void
  onBookmark?: (contentId: string) => void
  onView?: (contentId: string) => void
  onRate?: (contentId: string, rating: number) => void
  bookmarkedIds?: string[]
  userRatings?: Record<string, number>
}

export function ContentRecommendations({
  recommendations,
  isLoading = false,
  onRefresh,
  onBookmark,
  onView,
  onRate,
  bookmarkedIds = [],
  userRatings = {}
}: ContentRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('ai-recommended')

  // Group recommendations by type
  const aiRecommended = recommendations.filter(rec => 
    rec.reason.includes('AI') || rec.reason.includes('personalized')
  )
  
  const trending = recommendations.filter(rec => 
    rec.content.qualityMetrics.userRating >= 4.0 && 
    rec.content.qualityMetrics.completionRate >= 0.8
  )
  
  const peerRecommended = recommendations.filter(rec => 
    rec.reason.includes('peer') || rec.reason.includes('similar learners')
  )

  const getRecommendationIcon = (reason: string) => {
    if (reason.includes('AI') || reason.includes('personalized')) {
      return <Brain className="h-4 w-4 text-purple-500" />
    }
    if (reason.includes('peer') || reason.includes('similar')) {
      return <Users className="h-4 w-4 text-blue-500" />
    }
    if (reason.includes('trending') || reason.includes('popular')) {
      return <TrendingUp className="h-4 w-4 text-green-500" />
    }
    return <Sparkles className="h-4 w-4 text-yellow-500" />
  }

  const RecommendationSection = ({ 
    items, 
    title, 
    description 
  }: { 
    items: ContentRecommendation[]
    title: string
    description: string
  }) => (
    <div className="space-y-4">
      <div className="text-center py-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No AI-powered recommendations available right now.
              <br />
              Our AI system is learning your preferences. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((recommendation) => (
            <div key={recommendation.content.id} className="relative">
              <ContentCard
                content={recommendation.content}
                isBookmarked={bookmarkedIds.includes(recommendation.content.id)}
                onBookmark={onBookmark}
                onView={onView}
                onRate={onRate}
                userRating={userRatings[recommendation.content.id]}
              />
              
              {/* Recommendation reason overlay */}
              <div className="absolute top-2 left-2 z-10">
                <Badge 
                  variant="secondary" 
                  className="text-xs flex items-center gap-1 bg-background/90 backdrop-blur-sm"
                >
                  {getRecommendationIcon(recommendation.reason)}
                  <span className="max-w-24 truncate">{recommendation.reason}</span>
                </Badge>
              </div>
              
              {/* Relevance score */}
              <div className="absolute top-2 right-12 z-10">
                <Badge 
                  variant="outline" 
                  className="text-xs bg-background/90 backdrop-blur-sm"
                >
                  {Math.round(recommendation.relevanceScore * 100)}% match
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>Recommended for You</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ai-recommended" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Picks
              {aiRecommended.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {aiRecommended.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending
              {trending.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {trending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="peer-recommended" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Peer Picks
              {peerRecommended.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {peerRecommended.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-recommended" className="mt-6">
            <RecommendationSection
              items={aiRecommended}
              title="AI-Powered Recommendations"
              description="Personalized content based on your learning patterns, goals, and preferences"
            />
          </TabsContent>

          <TabsContent value="trending" className="mt-6">
            <RecommendationSection
              items={trending}
              title="Trending Content"
              description="Popular content with high ratings and completion rates from the community"
            />
          </TabsContent>

          <TabsContent value="peer-recommended" className="mt-6">
            <RecommendationSection
              items={peerRecommended}
              title="Peer Recommendations"
              description="Content that worked well for learners with similar goals and skill levels"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}