"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Brain } from 'lucide-react'

export function PublicNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">
              LusiLearn AI
            </span>
          </Link>
          <Badge variant="secondary" className="ml-2">
            Beta
          </Badge>
        </div>

        {/* Navigation Links */}
                  <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <Link href="#features" className="transition-colors hover:text-primary">
              Features
            </Link>
            <Link href="#education-levels" className="transition-colors hover:text-primary">
              Education Levels
            </Link>
            <Link href="/about" className="transition-colors hover:text-primary">
              About
            </Link>
          </nav>

        {/* Auth Buttons */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" asChild>
            <Link href="/auth/login">
              Sign In
            </Link>
          </Button>
          <Button asChild>
            <Link href="/auth/register">
              Sign Up
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
} 