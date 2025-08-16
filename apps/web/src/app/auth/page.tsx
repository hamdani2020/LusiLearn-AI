'use client'

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
  const handleLogin = async (data: { email: string; password: string }) => {
    // TODO: Implement actual login logic with API call
    console.log('Login attempt:', data)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In a real implementation, this would:
      // 1. Call the authentication API endpoint
      // 2. Store the JWT token in secure storage
      // 3. Redirect to the dashboard
      // 4. Update global auth state
      
      alert('Login successful! (This is a demo)')
      // window.location.href = '/dashboard'
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please check your credentials.')
    }
  }

  const handleRegister = async (data: any) => {
    // TODO: Implement actual registration logic with API call
    console.log('Registration attempt:', data)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // In a real implementation, this would:
      // 1. Call the registration API endpoint
      // 2. Handle email verification if required
      // 3. For minors, send parent notification email
      // 4. Create user profile and initial assessment
      // 5. Redirect to onboarding flow
      
      alert('Registration successful! (This is a demo)')
      
      // Handle minor account creation
      if (data.parentEmail) {
        console.log('Parent notification email would be sent to:', data.parentEmail)
      }
      
      // window.location.href = '/onboarding'
    } catch (error) {
      console.error('Registration failed:', error)
      alert('Registration failed. Please try again.')
    }
  }

  return (
    <AuthWrapper
      onLogin={handleLogin}
      onRegister={handleRegister}
    />
  )
}