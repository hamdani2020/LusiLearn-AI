"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Home, 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Target,
  User,
  Settings,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function MainNav() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = [
    {
      title: 'Home',
      href: '/',
      icon: Home
    },
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard
    },
    {
      title: 'Content',
      href: '/content',
      icon: Search
    },
    {
      title: 'Learning Paths',
      href: '/learning-paths',
      icon: BookOpen
    },
    {
      title: 'Collaboration',
      href: '/collaboration',
      icon: Users
    },
    {
      title: 'Goals',
      href: '/goals',
      icon: Target
    }
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-6 w-6 bg-primary rounded"></div>
            <span className="hidden font-bold sm:inline-block">
              LusiLearn AI
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-1 transition-colors hover:text-foreground/80",
                mounted && pathname === item.href ? "text-foreground" : "text-foreground/60"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline-block">{item.title}</span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center space-x-4">
          <Badge variant="secondary" className="hidden sm:flex">
            Beta
          </Badge>
          
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profile">
              <User className="h-4 w-4" />
              <span className="hidden sm:ml-2 sm:inline-block">Profile</span>
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}