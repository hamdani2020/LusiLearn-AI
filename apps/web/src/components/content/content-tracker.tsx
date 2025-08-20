'use client'

import { useEffect, useRef, useState } from 'react'
import { api, endpoints } from '@/lib/api'
import { ContentInteraction } from '@/types'

interface ContentTrackerProps {
  contentId: string
  userId: string
  children: React.ReactNode
  trackViewTime?: boolean
  trackScrollProgress?: boolean
  onInteraction?: (interaction: ContentInteraction) => void
}

export function ContentTracker({
  contentId,
  userId,
  children,
  trackViewTime = true,
  trackScrollProgress = false,
  onInteraction
}: ContentTrackerProps) {
  const [startTime] = useState(Date.now())
  const [isVisible, setIsVisible] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const elementRef = useRef<HTMLDivElement>(null)
  const lastProgressRef = useRef(0)

  // Track content interaction
  const trackInteraction = async (
    interactionType: ContentInteraction['interactionType'],
    metadata?: any
  ) => {
    // Only track interactions if we have a valid userId
    if (!userId || userId.trim() === '' || userId === 'anonymous') {
      return
    }

    try {
      const interaction: Omit<ContentInteraction, 'id'> = {
        userId,
        contentId,
        interactionType,
        timestamp: new Date(),
        ...metadata
      }

      await api.post(endpoints.content.interaction(userId), interaction)
      onInteraction?.(interaction as ContentInteraction)
    } catch (error) {
      console.error('Failed to track interaction:', error)
    }
  }

  // Track when content becomes visible
  useEffect(() => {
    if (!elementRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible
        const nowVisible = entry.isIntersecting

        setIsVisible(nowVisible)

        if (!wasVisible && nowVisible) {
          // Content became visible - track view
          trackInteraction('view')
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(elementRef.current)

    return () => observer.disconnect()
  }, [contentId, userId])

  // Track scroll progress
  useEffect(() => {
    if (!trackScrollProgress || !elementRef.current) return

    const handleScroll = () => {
      if (!elementRef.current) return

      const element = elementRef.current
      const rect = element.getBoundingClientRect()
      const windowHeight = window.innerHeight
      
      // Calculate how much of the content is visible
      const visibleTop = Math.max(0, -rect.top)
      const visibleBottom = Math.min(rect.height, windowHeight - rect.top)
      const visibleHeight = Math.max(0, visibleBottom - visibleTop)
      
      const progress = Math.min(100, (visibleHeight / rect.height) * 100)
      setScrollProgress(Math.round(progress))

      // Track progress milestones (25%, 50%, 75%, 100%)
      const milestones = [25, 50, 75, 100]
      const currentMilestone = milestones.find(
        milestone => progress >= milestone && lastProgressRef.current < milestone
      )

      if (currentMilestone) {
        lastProgressRef.current = currentMilestone
        trackInteraction('view', { 
          progress: Math.round(currentMilestone)
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [trackScrollProgress, contentId, userId])

  // Track view time when component unmounts or content changes
  useEffect(() => {
    return () => {
      if (trackViewTime && isVisible) {
        const duration = Date.now() - startTime
        if (duration > 1000) { // Only track if viewed for more than 1 second
          trackInteraction('view', { 
            duration: Math.round(duration / 1000),
            progress: Math.round(scrollProgress) 
          })
        }
      }
    }
  }, [contentId, userId, trackViewTime, isVisible, scrollProgress])

  return (
    <div ref={elementRef} className="w-full">
      {children}
    </div>
  )
}