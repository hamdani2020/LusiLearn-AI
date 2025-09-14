'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star, Clock, BookOpen, Bookmark, BookmarkCheck, Play, ExternalLink, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ContentItem, ContentSource, ContentFormat, DifficultyLevel } from '@/types'

interface ContentCardProps {
  content: ContentItem
  isBookmarked?: boolean
  progress?: number
  onBookmark?: (contentId: string) => void
  onView?: (contentId: string) => void
  onRate?: (contentId: string, rating: number) => void
  userRating?: number
  showProgress?: boolean
}

export function ContentCard({
  content,
  isBookmarked = false,
  progress = 0,
  onBookmark,
  onView,
  onRate,
  userRating,
  showProgress = false
}: ContentCardProps) {
  const [currentRating, setCurrentRating] = useState(userRating || 0)
  const [isRating, setIsRating] = useState(false)

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const getSourceIcon = (source: ContentSource) => {
    switch (source) {
      case ContentSource.YOUTUBE:
        return '📺'
      case ContentSource.KHAN_ACADEMY:
        return '🎓'
      case ContentSource.COURSERA:
        return '📚'
      case ContentSource.GITHUB:
        return '💻'
      default:
        return '📖'
    }
  }

  const getFormatIcon = (format: ContentFormat) => {
    switch (format) {
      case ContentFormat.VIDEO:
        return <Play className="h-4 w-4" />
      case ContentFormat.ARTICLE:
        return <BookOpen className="h-4 w-4" />
      case ContentFormat.INTERACTIVE:
        return <Eye className="h-4 w-4" />
      default:
        return <BookOpen className="h-4 w-4" />
    }
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
    setIsRating(false)
  }

  const handleView = () => {
    onView?.(content.id)
    // Open content in new tab
    window.open(content.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getSourceIcon(content.source)}</span>
              <Badge variant="outline" className="text-xs">
                {content.source.replace('_', ' ')}
              </Badge>
              <Badge className={`text-xs ${getDifficultyColor(content.metadata?.difficulty || 'beginner')}`}>
                {content.metadata?.difficulty || 'beginner'}
              </Badge>
            </div>
            
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {content.title}
            </h3>
            
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {content.description}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBookmark?.(content.id)}
            className="shrink-0 h-8 w-8 p-0"
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-primary" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress bar if showing progress */}
        {showProgress && progress > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            {getFormatIcon(content.metadata?.format || 'video')}
            <span className="capitalize">{content.metadata?.format || 'video'}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(content.metadata?.duration || 0)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-current text-yellow-400" />
            <span>{(content.qualityMetrics?.userRating || 4.5).toFixed(1)}</span>
          </div>
        </div>

        {/* Topics */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(content.metadata.topics || []).slice(0, 3).map((topic, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
          {(content.metadata.topics || []).length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{(content.metadata.topics || []).length - 3} more
            </Badge>
          )}
        </div>

        {/* Rating */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rate:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  onMouseEnter={() => setIsRating(true)}
                  onMouseLeave={() => setIsRating(false)}
                  className="text-yellow-400 hover:text-yellow-500 transition-colors"
                >
                  <Star
                    className={`h-3 w-3 ${
                      star <= (isRating ? star : currentRating)
                        ? 'fill-current'
                        : 'stroke-current fill-transparent'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            asChild
            className="flex-1 h-8 text-xs"
            size="sm"
          >
            <Link href={`/content/${content.id}`}>
              <Eye className="h-3 w-3 mr-1" />
              View Details
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleView}
            className="h-8 text-xs px-2"
            size="sm"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}