'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  ExternalLink, 
  Clock,
  Star,
  Bookmark,
  BookmarkCheck,
  Share2,
  Flag,
  CheckCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ContentTracker } from './content-tracker'
import { ContentItem, ContentFormat, DifficultyLevel } from '@/types'

interface ContentViewerProps {
  content: ContentItem
  userId: string
  isBookmarked?: boolean
  userRating?: number
  progress?: number
  onBookmark?: (contentId: string) => void
  onRate?: (contentId: string, rating: number) => void
  onComplete?: (contentId: string) => void
  onShare?: (contentId: string) => void
  onReport?: (contentId: string) => void
}

export function ContentViewer({
  content,
  userId,
  isBookmarked = false,
  userRating = 0,
  progress = 0,
  onBookmark,
  onRate,
  onComplete,
  onShare,
  onReport
}: ContentViewerProps) {
  const [currentRating, setCurrentRating] = useState(userRating)
  const [isCompleted, setIsCompleted] = useState(progress >= 100)
  const [viewProgress, setViewProgress] = useState(progress)

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getDifficultyColor = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case DifficultyLevel.BEGINNER:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case DifficultyLevel.INTERMEDIATE:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case DifficultyLevel.ADVANCED:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case DifficultyLevel.EXPERT:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const handleRating = (rating: number) => {
    setCurrentRating(rating)
    onRate?.(content.id, rating)
  }

  const handleComplete = () => {
    setIsCompleted(true)
    setViewProgress(100)
    onComplete?.(content.id)
  }

  const renderContentEmbed = () => {
    switch (content.metadata.format) {
      case ContentFormat.VIDEO:
        if (content.source === 'youtube') {
          // Extract YouTube video ID from URL
          const videoId = content.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1]
          if (videoId) {
            return (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={content.title}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )
          }
        }
        break
      
      case ContentFormat.INTERACTIVE:
        return (
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Interactive content</p>
              <Button 
                className="mt-4" 
                onClick={() => window.open(content.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Interactive Content
              </Button>
            </div>
          </div>
        )
      
      default:
        return (
          <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <ExternalLink className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">External content</p>
              <Button 
                className="mt-4" 
                onClick={() => window.open(content.url, '_blank')}
              >
                View Content
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <ContentTracker
      contentId={content.id}
      userId={userId}
      trackViewTime={true}
      trackScrollProgress={true}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Content Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline">
                    {content.source.replace('_', ' ')}
                  </Badge>
                  <Badge className={getDifficultyColor(content.metadata.difficulty)}>
                    {content.metadata.difficulty}
                  </Badge>
                  <Badge variant="secondary">
                    {content.metadata.format}
                  </Badge>
                </div>
                
                <CardTitle className="text-2xl mb-2">{content.title}</CardTitle>
                <p className="text-muted-foreground">{content.description}</p>
                
                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(content.metadata.duration)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-yellow-400" />
                    <span>{(content.qualityMetrics?.userRating || 0).toFixed(1)}</span>
                  </div>
                  <div>
                    Subject: {content.metadata.subject}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBookmark?.(content.id)}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="h-4 w-4 text-primary" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onShare?.(content.id)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReport?.(content.id)}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Progress Tracking */}
        {viewProgress > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Your Progress</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(viewProgress)}%
                </span>
              </div>
              <Progress value={viewProgress} className="mb-3" />
              
              {!isCompleted && viewProgress >= 80 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Almost done! Mark as complete when finished.
                  </span>
                  <Button size="sm" onClick={handleComplete}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              )}
              
              {isCompleted && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Completed!</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content Embed */}
        <Card>
          <CardContent className="pt-6">
            {renderContentEmbed()}
          </CardContent>
        </Card>

        {/* Topics and Rating */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Topics */}
              <div>
                <h3 className="font-medium mb-2">Topics Covered</h3>
                <div className="flex flex-wrap gap-2">
                  {(content.metadata.topics || []).map((topic, index) => (
                    <Badge key={index} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <h3 className="font-medium mb-2">Rate this content</h3>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRating(star)}
                        className="text-yellow-400 hover:text-yellow-500 transition-colors"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            star <= currentRating
                              ? 'fill-current'
                              : 'stroke-current fill-transparent'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {currentRating > 0 && (
                    <span className="text-sm text-muted-foreground ml-2">
                      You rated this {currentRating} star{currentRating !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Quality Metrics */}
              <div>
                <h3 className="font-medium mb-2">Community Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Average Rating:</span>
                    <span className="ml-2 font-medium">
                      {(content.qualityMetrics?.userRating || 0).toFixed(1)}/5
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completion Rate:</span>
                    <span className="ml-2 font-medium">
                      {Math.round((content.qualityMetrics?.completionRate || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentTracker>
  )
}