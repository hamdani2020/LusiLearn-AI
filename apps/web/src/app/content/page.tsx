'use client'

import { useState, useEffect } from 'react'

// Disable static generation for this page
export const dynamic = 'force-dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MainNav } from '@/components/navigation/main-nav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Sparkles, Library, TrendingUp, AlertCircle } from 'lucide-react'
import { ContentSearch } from '@/components/content/content-search'
import { ContentCard } from '@/components/content/content-card'
import { ContentRecommendations } from '@/components/content/content-recommendations'
import { PersonalLibrary } from '@/components/content/personal-library'
import { api, endpoints } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { 
  ContentSearchQuery, 
  ContentSearchResult, 
  ContentRecommendation, 
  BookmarkedContent,
  ContentInteraction 
} from '@/types'

export default function ContentDiscoveryPage() {
  const [activeTab, setActiveTab] = useState('discover')
  const [searchResults, setSearchResults] = useState<ContentSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [userRatings, setUserRatings] = useState<Record<string, number>>({})
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuth()

  // Fetch recommendations
  const { data: recommendationsResponse, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: async () => {
      if (!user?.id) return { success: false, data: [] }
      const response = await api.get<{ success: boolean; data: ContentRecommendation[] }>(
        `${endpoints.content.recommendations(user.id)}&subject=programming&limit=10`
      )
      return response
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch bookmarks
  const { data: bookmarksResponse, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['bookmarks', user?.id],
    queryFn: async () => {
      if (!user?.id) return { success: false, data: [] }
      const response = await api.get<{ success: boolean; data: BookmarkedContent[] }>(
        endpoints.content.bookmarks(user.id)
      )
      return response
    },
    enabled: !!user?.id,
  })

  const recommendations = recommendationsResponse?.data || []
  const bookmarks = bookmarksResponse?.data || []

  // Bookmark mutations
  const bookmarkMutation = useMutation({
    mutationFn: async (contentId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const isBookmarked = (bookmarks as BookmarkedContent[]).some((bookmark: BookmarkedContent) => bookmark.contentId === contentId)
      if (isBookmarked) {
        // Remove bookmark
        const bookmark = (bookmarks as BookmarkedContent[]).find((b: BookmarkedContent) => b.contentId === contentId)
        if (bookmark) {
          await api.delete(endpoints.content.bookmark(user.id, bookmark.id))
        }
      } else {
        // Add bookmark
        await api.post(endpoints.content.bookmark(user.id, contentId), {
          tags: [],
          notes: ''
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] })
    },
  })

  // Update bookmark tags
  const updateTagsMutation = useMutation({
    mutationFn: async ({ bookmarkId, tags }: { bookmarkId: string; tags: string[] }) => {
      await api.put(`/api/v1/bookmarks/${bookmarkId}`, { tags })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] })
    },
  })

  // Update bookmark notes
  const updateNotesMutation = useMutation({
    mutationFn: async ({ bookmarkId, notes }: { bookmarkId: string; notes: string }) => {
      await api.put(`/api/v1/bookmarks/${bookmarkId}`, { notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] })
    },
  })

  // Remove bookmark
  const removeBookmarkMutation = useMutation({
    mutationFn: async (bookmarkId: string) => {
      await api.delete(`/api/v1/bookmarks/${bookmarkId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks', user?.id] })
    },
  })

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user?.id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to access content</p>
          <a href="/auth/login" className="text-primary hover:underline">Go to Login</a>
        </div>
      </div>
    )
  }

  // Get bookmarked content IDs for easy lookup
  const bookmarkedIds = Array.isArray(bookmarks)
    ? bookmarks.map((bookmark: BookmarkedContent) => bookmark.contentId)
    : []

  // Mock user ratings - in real app this would come from API

  // Search content
  const handleSearch = async (query: ContentSearchQuery) => {
    setIsSearching(true)
    try {
      const response = await api.post<{ success: boolean; data: ContentSearchResult }>(
        endpoints.content.search,
        query
      )
      setSearchResults(response.data?.data || null)
    } catch (error) {
      console.error('Search failed:', error)
      // Show error state
      setSearchResults({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
        filters: {
          subjects: [],
          difficulties: [],
          formats: [],
          sources: []
        }
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Track content interaction
  const trackInteraction = async (contentId: string, interactionType: ContentInteraction['interactionType'], metadata?: any) => {
    if (!user?.id) return
    try {
      await api.post(endpoints.content.interaction(user.id), {
        contentId,
        interactionType,
        ...metadata,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to track interaction:', error)
    }
  }

  // Handle content view
  const handleView = async (contentId: string) => {
    await trackInteraction(contentId, 'view')
  }

  // Handle content rating
  const handleRate = async (contentId: string, rating: number) => {
    setUserRatings(prev => ({ ...prev, [contentId]: rating }))
    await trackInteraction(contentId, 'rate', { rating })
    
    // Also send to content rating endpoint
    try {
      await api.post(endpoints.content.rate(contentId), { rating })
    } catch (error) {
      console.error('Failed to submit rating:', error)
    }
  }

  // Handle bookmark toggle
  const handleBookmark = (contentId: string) => {
    bookmarkMutation.mutate(contentId)
    const isBookmarked = bookmarkedIds.includes(contentId)
    trackInteraction(contentId, 'bookmark', { action: isBookmarked ? 'remove' : 'add' })
  }

  return (
    <>
      <MainNav />
      <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Discovery</h1>
        <p className="text-muted-foreground">
          Explore personalized learning content from multiple sources
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            For You
            {Array.isArray(recommendations) && recommendations.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {recommendations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Library
            {Array.isArray(bookmarks) && bookmarks.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {bookmarks.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Discover Tab - Search and Browse */}
        <TabsContent value="discover" className="mt-6 space-y-6">
          <ContentSearch
            onSearch={handleSearch}
            availableFilters={searchResults?.filters}
            isLoading={isSearching}
          />

          {searchResults && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Search Results ({searchResults.total})
                  </h3>
                  {searchResults.totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Page {searchResults.page} of {searchResults.totalPages}
                      </span>
                      {/* Add pagination controls here */}
                    </div>
                  )}
                </div>

                {searchResults.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No content found matching your search criteria.
                      <br />
                      Try adjusting your filters or search terms.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.items.map((content) => (
                      <ContentCard
                        key={content.id}
                        content={content}
                        isBookmarked={bookmarkedIds.includes(content.id)}
                        onBookmark={handleBookmark}
                        onView={handleView}
                        onRate={handleRate}
                        userRating={userRatings[content.id]}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="mt-6">
          <ContentRecommendations
            recommendations={recommendations as ContentRecommendation[]}
            isLoading={recommendationsLoading}
            onRefresh={() => refetchRecommendations()}
            onBookmark={handleBookmark}
            onView={handleView}
            onRate={handleRate}
            bookmarkedIds={bookmarkedIds}
            userRatings={userRatings}
          />
        </TabsContent>

        {/* Trending Tab */}
        <TabsContent value="trending" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Trending content feature coming soon!
                  <br />
                  This will show popular content based on community engagement.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Personal Library Tab */}
        <TabsContent value="library" className="mt-6">
          <PersonalLibrary
            bookmarks={bookmarks as BookmarkedContent[]}
            isLoading={bookmarksLoading}
            onRemoveBookmark={(bookmarkId) => removeBookmarkMutation.mutate(bookmarkId)}
            onUpdateTags={(bookmarkId, tags) => updateTagsMutation.mutate({ bookmarkId, tags })}
            onUpdateNotes={(bookmarkId, notes) => updateNotesMutation.mutate({ bookmarkId, notes })}
            onView={handleView}
            onRate={handleRate}
            userRatings={userRatings}
          />
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}