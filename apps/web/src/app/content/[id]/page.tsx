'use client'

// Disable static generation for this page
export const dynamic = 'force-dynamic'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { MainNav } from '@/components/navigation/main-nav'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ContentViewer } from '@/components/content/content-viewer'
import { api, endpoints } from '@/lib/api'
import { ContentItem } from '@/types'

// Mock user ID - in real app this would come from auth context
const MOCK_USER_ID = 'user-123'

export default function ContentPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const contentId = params.id as string

  // Fetch content details
  const { data: content, isLoading, error } = useQuery({
    queryKey: ['content', contentId],
    queryFn: async () => {
      const response = await api.get<{ data: ContentItem }>(
        endpoints.content.item(contentId)
      )
      return response.data
    },
    enabled: !!contentId,
  })

  // Fetch user's bookmark status
  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks', MOCK_USER_ID],
    queryFn: async () => {
      const response = await api.get<{ data: any[] }>(
        endpoints.content.bookmarks(MOCK_USER_ID)
      )
      return response.data
    },
  })

  // Check if content is bookmarked
  const isBookmarked = bookmarks.some(bookmark => bookmark.contentId === contentId)

  // Mock user rating and progress - in real app these would come from API
  const userRating = 0 // This would be fetched from user interactions
  const progress = 0 // This would be fetched from learning progress

  // Bookmark mutation
  const bookmarkMutation = useMutation({
    mutationFn: async (contentId: string) => {
      if (isBookmarked) {
        // Remove bookmark
        const bookmark = bookmarks.find(b => b.contentId === contentId)
        if (bookmark) {
          await api.delete(endpoints.content.bookmark(MOCK_USER_ID, bookmark.id))
        }
      } else {
        // Add bookmark
        await api.post(endpoints.content.bookmark(MOCK_USER_ID, contentId), {
          tags: [],
          notes: ''
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', MOCK_USER_ID] })
    },
  })

  // Track content interaction
  const trackInteraction = async (interactionType: string, metadata?: any) => {
    try {
      await api.post(endpoints.content.interaction(MOCK_USER_ID), {
        contentId,
        interactionType,
        ...metadata,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to track interaction:', error)
    }
  }

  const handleBookmark = (contentId: string) => {
    bookmarkMutation.mutate(contentId)
    trackInteraction('bookmark', { action: isBookmarked ? 'remove' : 'add' })
  }

  const handleRate = async (contentId: string, rating: number) => {
    await trackInteraction('rate', { rating })
    
    // Also send to content rating endpoint
    try {
      await api.post(endpoints.content.rate(contentId), { rating })
    } catch (error) {
      console.error('Failed to submit rating:', error)
    }
  }

  const handleComplete = async (contentId: string) => {
    await trackInteraction('complete', { progress: 100 })
    // In a real app, this would update the user's learning progress
  }

  const handleShare = async (contentId: string) => {
    if (navigator.share && content) {
      try {
        await navigator.share({
          title: content.title,
          text: content.description,
          url: window.location.href,
        })
        await trackInteraction('share', { method: 'native' })
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href)
        await trackInteraction('share', { method: 'clipboard' })
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(window.location.href)
      await trackInteraction('share', { method: 'clipboard' })
    }
  }

  const handleReport = async (contentId: string) => {
    // In a real app, this would open a report modal
    console.log('Report content:', contentId)
    await trackInteraction('report')
  }

  if (isLoading) {
    return (
      <>
        <MainNav />
        <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading content...</p>
          </div>
        </div>
        </div>
      </>
    )
  }

  if (error || !content) {
    return (
      <>
        <MainNav />
        <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h2 className="text-xl font-semibold mb-2">Content Not Found</h2>
            <p className="text-muted-foreground text-center mb-4">
              The content you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => router.push('/content')}>
              Browse Content
            </Button>
          </CardContent>
        </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <MainNav />
      <div className="container mx-auto px-4 py-8">
      {/* Back Navigation */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Content Discovery
        </Button>
      </div>

      {/* Content Viewer */}
      <ContentViewer
        content={content}
        userId={MOCK_USER_ID}
        isBookmarked={isBookmarked}
        userRating={userRating}
        progress={progress}
        onBookmark={handleBookmark}
        onRate={handleRate}
        onComplete={handleComplete}
        onShare={handleShare}
        onReport={handleReport}
      />
      </div>
    </>
  )
}