'use client'

import { useState } from 'react'
import { LoginForm } from './login-form'
import { RegistrationForm } from './registration-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Users, BookOpen, Zap } from 'lucide-react'

type AuthMode = 'login' | 'register'

interface AuthWrapperProps {
  onLogin: (data: { email: string; password: string }) => Promise<void>
  onRegister: (data: any) => Promise<void>
  isLoading?: boolean
}

export function AuthWrapper({ onLogin, onRegister, isLoading = false }: AuthWrapperProps) {
  const [mode, setMode] = useState<AuthMode>('login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding and features */}
        <div className="hidden lg:block space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome to LusiLearn AI
            </h1>
            <p className="text-xl text-gray-600">
              Personalized learning powered by artificial intelligence
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Adaptive Learning Paths</h3>
                <p className="text-gray-600">
                  AI-powered curriculum that adapts to your learning style and pace
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Peer Collaboration</h3>
                <p className="text-gray-600">
                  Connect with study partners and mentors for collaborative learning
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Real-time Progress</h3>
                <p className="text-gray-600">
                  Track your learning journey with detailed analytics and insights
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Safe Learning Environment</h3>
                <p className="text-gray-600">
                  Age-appropriate content with comprehensive safety and parental controls
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Authentication forms */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          {mode === 'login' ? (
            <LoginForm
              onSubmit={onLogin}
              onSwitchToRegister={() => setMode('register')}
            />
          ) : (
            <RegistrationForm
              onSubmit={onRegister}
              onSwitchToLogin={() => setMode('login')}
            />
          )}

          {/* Mobile branding */}
          <div className="lg:hidden mt-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              LusiLearn AI
            </h2>
            <p className="text-gray-600">
              Personalized learning for K-12, college, and professional development
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}