import { useState, useEffect } from 'react'
import { api, ApiResponse } from '@/lib/api'

interface User {
  id: string
  email: string
  role?: string
}

interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if we have a token
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setUser(null)
        return
      }

      const response = await api.get<User>('/api/v1/auth/me')
      
      if (response.success && response.data) {
        setUser(response.data)
      } else {
        setUser(null)
        setError('Failed to fetch user data')
      }
    } catch (err: any) {
      console.error('Failed to fetch user:', err)
      setUser(null)
      setError(err.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser
  }
} 