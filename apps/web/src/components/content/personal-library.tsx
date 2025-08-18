'use client'

import { useState } from 'react'
import { Library, Search, Filter, Tag, Trash2, Edit3, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentCard } from './content-card'
import { BookmarkedContent, ContentFormat, DifficultyLevel } from '@/types'

interface PersonalLibraryProps {
  bookmarks: BookmarkedContent[]
  isLoading?: boolean
  onRemoveBookmark?: (bookmarkId: string) => void
  onUpdateTags?: (bookmarkId: string, tags: string[]) => void
  onUpdateNotes?: (bookmarkId: string, notes: string) => void
  onView?: (contentId: string) => void
  onRate?: (contentId: string, rating: number) => void
  userRatings?: Record<string, number>
}

export function PersonalLibrary({
  bookmarks,
  isLoading = false,
  onRemoveBookmark,
  onUpdateTags,
  onUpdateNotes,
  onView,
  onRate,
  userRatings = {}
}: PersonalLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [selectedFormat, setSelectedFormat] = useState<string>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [editingTags, setEditingTags] = useState<string | null>(null)
  const [tempNotes, setTempNotes] = useState('')
  const [tempTags, setTempTags] = useState('')

  // Get all unique tags from bookmarks
  const allTags = Array.from(
    new Set(bookmarks.flatMap(bookmark => bookmark.tags))
  ).sort()

  // Filter bookmarks based on search and filters
  const filteredBookmarks = bookmarks.filter(bookmark => {
    const matchesSearch = !searchQuery || 
      bookmark.content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.content.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesTag = selectedTag === 'all' || bookmark.tags.includes(selectedTag)
    
    const matchesFormat = selectedFormat === 'all' || 
      bookmark.content.metadata.format === selectedFormat
    
    const matchesDifficulty = selectedDifficulty === 'all' || 
      bookmark.content.metadata.difficulty === selectedDifficulty

    return matchesSearch && matchesTag && matchesFormat && matchesDifficulty
  })

  // Group bookmarks by tags for organization
  const bookmarksByTag = allTags.reduce((acc, tag) => {
    acc[tag] = bookmarks.filter(bookmark => bookmark.tags.includes(tag))
    return acc
  }, {} as Record<string, BookmarkedContent[]>)

  const handleSaveNotes = (bookmarkId: string) => {
    onUpdateNotes?.(bookmarkId, tempNotes)
    setEditingNotes(null)
    setTempNotes('')
  }

  const handleSaveTags = (bookmarkId: string) => {
    const newTags = tempTags.split(',').map(tag => tag.trim()).filter(Boolean)
    onUpdateTags?.(bookmarkId, newTags)
    setEditingTags(null)
    setTempTags('')
  }

  const startEditingNotes = (bookmark: BookmarkedContent) => {
    setEditingNotes(bookmark.id)
    setTempNotes(bookmark.notes || '')
  }

  const startEditingTags = (bookmark: BookmarkedContent) => {
    setEditingTags(bookmark.id)
    setTempTags(bookmark.tags.join(', '))
  }

  const LibraryGrid = ({ items }: { items: BookmarkedContent[] }) => (
    <div className="space-y-4">
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery || selectedTag !== 'all' || selectedFormat !== 'all' || selectedDifficulty !== 'all'
                ? 'No bookmarks match your current filters.'
                : 'Your library is empty. Start bookmarking content to build your personal collection!'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((bookmark) => (
            <div key={bookmark.id} className="space-y-3">
              <ContentCard
                content={bookmark.content}
                isBookmarked={true}
                onBookmark={() => onRemoveBookmark?.(bookmark.id)}
                onView={onView}
                onRate={onRate}
                userRating={userRatings[bookmark.content.id]}
              />
              
              {/* Bookmark metadata */}
              <Card className="p-3">
                {/* Tags */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Tags</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditingTags(bookmark)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {editingTags === bookmark.id ? (
                    <div className="space-y-2">
                      <Input
                        value={tempTags}
                        onChange={(e) => setTempTags(e.target.value)}
                        placeholder="Enter tags separated by commas"
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveTags(bookmark.id)}
                          className="h-6 text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTags(null)}
                          className="h-6 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {bookmark.tags.length > 0 ? (
                        bookmark.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Tag className="h-2 w-2 mr-1" />
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No tags</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Notes</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditingNotes(bookmark)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {editingNotes === bookmark.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        placeholder="Add your notes about this content..."
                        className="w-full p-2 text-xs border rounded-md resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveNotes(bookmark.id)}
                          className="h-6 text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNotes(null)}
                          className="h-6 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {bookmark.notes || 'No notes added'}
                    </p>
                  )}
                </div>

                {/* Remove bookmark */}
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemoveBookmark?.(bookmark.id)}
                    className="w-full h-6 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Remove from Library
                  </Button>
                </div>
              </Card>
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
            <Library className="h-5 w-5 text-primary" />
            <CardTitle>Personal Library</CardTitle>
            <Badge variant="secondary">{bookmarks.length} items</Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag} ({bookmarksByTag[tag]?.length || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All formats</SelectItem>
                <SelectItem value={ContentFormat.VIDEO}>Video</SelectItem>
                <SelectItem value={ContentFormat.ARTICLE}>Article</SelectItem>
                <SelectItem value={ContentFormat.INTERACTIVE}>Interactive</SelectItem>
                <SelectItem value={ContentFormat.QUIZ}>Quiz</SelectItem>
                <SelectItem value={ContentFormat.PROJECT}>Project</SelectItem>
                <SelectItem value={ContentFormat.TUTORIAL}>Tutorial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value={DifficultyLevel.BEGINNER}>Beginner</SelectItem>
                <SelectItem value={DifficultyLevel.INTERMEDIATE}>Intermediate</SelectItem>
                <SelectItem value={DifficultyLevel.ADVANCED}>Advanced</SelectItem>
                <SelectItem value={DifficultyLevel.EXPERT}>Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">
              All Items ({filteredBookmarks.length})
            </TabsTrigger>
            <TabsTrigger value="by-tags">
              By Tags ({allTags.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <LibraryGrid items={filteredBookmarks} />
          </TabsContent>

          <TabsContent value="by-tags" className="mt-6">
            <div className="space-y-6">
              {allTags.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Tag className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No tags created yet. Add tags to your bookmarks to organize them better!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                allTags.map(tag => {
                  const tagBookmarks = bookmarksByTag[tag] || []
                  if (tagBookmarks.length === 0) return null
                  
                  return (
                    <div key={tag}>
                      <div className="flex items-center gap-2 mb-4">
                        <Tag className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-semibold">{tag}</h3>
                        <Badge variant="secondary">{tagBookmarks.length} items</Badge>
                      </div>
                      <LibraryGrid items={tagBookmarks} />
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}