"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Play, 
  Search, 
  Users, 
  BookOpen, 
  Target,
  Brain,
  Calendar,
  MessageCircle
} from 'lucide-react'

export function QuickActions() {
  const actions = [
    {
      id: 'continue-learning',
      title: 'Continue Learning',
      description: 'Resume your current path',
      icon: Play,
      color: 'bg-primary text-primary-foreground hover:bg-primary/90',
      href: '/learning-paths/current'
    },
    {
      id: 'find-content',
      title: 'Find Content',
      description: 'Search for new materials',
      icon: Search,
      color: 'bg-blue-500 text-white hover:bg-blue-600',
      href: '/content/search'
    },
    {
      id: 'join-study-group',
      title: 'Study Groups',
      description: 'Connect with peers',
      icon: Users,
      color: 'bg-green-500 text-white hover:bg-green-600',
      href: '/collaboration/groups'
    },
    {
      id: 'browse-library',
      title: 'My Library',
      description: 'View saved content',
      icon: BookOpen,
      color: 'bg-purple-500 text-white hover:bg-purple-600',
      href: '/library'
    },
    {
      id: 'set-goals',
      title: 'Set Goals',
      description: 'Plan your learning',
      icon: Target,
      color: 'bg-orange-500 text-white hover:bg-orange-600',
      href: '/goals'
    },
    {
      id: 'ai-tutor',
      title: 'AI Tutor',
      description: 'Get personalized help',
      icon: Brain,
      color: 'bg-pink-500 text-white hover:bg-pink-600',
      href: '/ai-tutor'
    },
    {
      id: 'schedule-session',
      title: 'Schedule',
      description: 'Plan study sessions',
      icon: Calendar,
      color: 'bg-indigo-500 text-white hover:bg-indigo-600',
      href: '/schedule'
    },
    {
      id: 'ask-community',
      title: 'Ask Community',
      description: 'Get help from peers',
      icon: MessageCircle,
      color: 'bg-teal-500 text-white hover:bg-teal-600',
      href: '/community/ask'
    }
  ]

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className={`h-auto p-4 flex flex-col items-center space-y-2 ${action.color} border-0`}
              onClick={() => {
                // In real app, this would use Next.js router
                console.log(`Navigate to: ${action.href}`)
              }}
            >
              <action.icon className="h-6 w-6" />
              <div className="text-center">
                <p className="font-medium text-xs leading-tight">{action.title}</p>
                <p className="text-xs opacity-80 leading-tight">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}