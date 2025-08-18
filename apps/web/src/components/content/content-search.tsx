'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContentSearchQuery, DifficultyLevel, ContentFormat, ContentSource, AgeRating } from '@/types'

interface ContentSearchProps {
  onSearch: (query: ContentSearchQuery) => void
  availableFilters?: {
    subjects: string[]
    difficulties: DifficultyLevel[]
    formats: ContentFormat[]
    sources: ContentSource[]
  }
  isLoading?: boolean
}

export function ContentSearch({ onSearch, availableFilters, isLoading }: ContentSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<ContentSearchQuery>({})
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = () => {
    onSearch({
      query: searchQuery || undefined,
      ...filters,
      page: 1
    })
  }

  const handleFilterChange = (key: keyof ContentSearchQuery, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value
    }))
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
  }

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined).length

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery || Object.keys(filters).length > 0) {
        handleSearch()
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, filters])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Search Content</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search for topics, skills, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            {/* Subject Filter */}
            {availableFilters?.subjects && (
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Select
                  value={filters.subject || 'all'}
                  onValueChange={(value) => handleFilterChange('subject', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {availableFilters.subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>
                        {subject.charAt(0).toUpperCase() + subject.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Difficulty Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Difficulty</label>
              <Select
                value={filters.difficulty || 'all'}
                onValueChange={(value) => handleFilterChange('difficulty', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
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

            {/* Format Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <Select
                value={filters.format || 'all'}
                onValueChange={(value) => handleFilterChange('format', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All formats" />
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
            </div>

            {/* Source Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Source</label>
              <Select
                value={filters.source || 'all'}
                onValueChange={(value) => handleFilterChange('source', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value={ContentSource.YOUTUBE}>YouTube</SelectItem>
                  <SelectItem value={ContentSource.KHAN_ACADEMY}>Khan Academy</SelectItem>
                  <SelectItem value={ContentSource.COURSERA}>Coursera</SelectItem>
                  <SelectItem value={ContentSource.GITHUB}>GitHub</SelectItem>
                  <SelectItem value={ContentSource.INTERNAL}>Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
              <Select
                value={filters.duration ? `${filters.duration.min}-${filters.duration.max}` : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    handleFilterChange('duration', undefined)
                  } else {
                    const [min, max] = value.split('-').map(Number)
                    handleFilterChange('duration', { min, max })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any duration</SelectItem>
                  <SelectItem value="0-10">0-10 minutes</SelectItem>
                  <SelectItem value="10-30">10-30 minutes</SelectItem>
                  <SelectItem value="30-60">30-60 minutes</SelectItem>
                  <SelectItem value="60-999">60+ minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
                disabled={activeFilterCount === 0}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.subject && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Subject: {filters.subject}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange('subject', undefined)}
                />
              </Badge>
            )}
            {filters.difficulty && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Difficulty: {filters.difficulty}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange('difficulty', undefined)}
                />
              </Badge>
            )}
            {filters.format && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Format: {filters.format}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange('format', undefined)}
                />
              </Badge>
            )}
            {filters.source && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Source: {filters.source}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => handleFilterChange('source', undefined)}
                />
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}