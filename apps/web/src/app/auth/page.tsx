'use client'

import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const AuthWrapper = dynamic(
  () => import('@/components/auth/auth-wrapper').then(mod => ({ default: mod.AuthWrapper })),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ),
    ssr: false
  }
)

export default function AuthPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'login'
  const handleLogin = async (data: { email: string; password: string }) => {
    try {
      const { api } = await import('@/lib/api')
      const response = await api.login(data)
      
      if (response.success) {
        console.log('Debug - Login successful:', response.data)
        console.log('Debug - Response structure:', {
          hasData: !!response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
          hasAccessToken: response.data?.accessToken ? true : false,
          hasRefreshToken: response.data?.refreshToken ? true : false,
          hasUser: response.data?.user ? true : false
        })
        
        // Check if tokens were stored
        const accessToken = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken')
        console.log('Debug - Tokens stored:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        })
        
        // Add a longer delay to ensure tokens are properly stored and propagated
        setTimeout(() => {
          console.log('Debug - Redirecting to onboarding...')
          window.location.href = '/onboarding'
        }, 500)
      } else {
        console.log('Debug - Login failed:', response)
        alert(response.message || 'Login failed')
      }
    } catch (error: any) {
      console.error('Login failed:', error)
      alert(error.message || 'Login failed. Please check your credentials.')
    }
  }

  const handleRegister = async (data: any) => {
    try {
      const { api } = await import('@/lib/api')
      
      // Transform form data to match API schema
      const registerData = {
        email: data.email,
        password: data.password,
        username: data.username,
        demographics: {
          ageRange: data.ageRange,
          educationLevel: data.educationLevel,
          timezone: data.timezone,
          preferredLanguage: data.preferredLanguage,
        },
        learningPreferences: {
          learningStyle: ['visual'], // Default values, can be updated later
          preferredContentTypes: ['video'],
          sessionDuration: 45,
          difficultyPreference: 'moderate',
        },
        ...(data.parentEmail && {
          parentalControls: {
            parentEmail: data.parentEmail,
            restrictedInteractions: true,
            contentFiltering: 'strict',
            timeRestrictions: {
              dailyLimit: 120,
              allowedHours: {
                start: '08:00',
                end: '20:00',
              },
            },
          },
        }),
      }
      
      const response = await api.register(registerData)
      
      if (response.success) {
        console.log('Debug - Registration successful:', response.data)
        
        // Check if tokens were stored
        const accessToken = localStorage.getItem('accessToken')
        const refreshToken = localStorage.getItem('refreshToken')
        console.log('Debug - Tokens stored:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken 
        })
        
        // Handle minor account creation
        if (data.parentEmail) {
          console.log('Parent notification email sent to:', data.parentEmail)
        }
        
        // Add a small delay to ensure tokens are stored before redirect
        setTimeout(() => {
          console.log('Debug - Redirecting to dashboard...')
          window.location.href = '/dashboard'
        }, 200)
      } else {
        console.log('Debug - Registration failed:', response)
        alert(response.message || 'Registration failed')
      }
    } catch (error: any) {
      console.error('Registration failed:', error)
      alert(error.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <AuthWrapper
      mode={mode as 'login' | 'register'}
      onLogin={handleLogin}
      onRegister={handleRegister}
    />
  )
}