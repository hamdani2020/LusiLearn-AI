const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  error?: string
}



export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  username: string
  demographics: {
    ageRange: string
    educationLevel: string
    timezone: string
    preferredLanguage: string
  }
  learningPreferences: {
    learningStyle: string[]
    preferredContentTypes: string[]
    sessionDuration: number
    difficultyPreference: string
  }
  parentalControls?: {
    parentEmail: string
    restrictedInteractions: boolean
    contentFiltering: string
    timeRestrictions: {
      dailyLimit: number
      allowedHours: {
        start: string
        end: string
      }
    }
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      console.log('Debug - Adding token to request:', { 
        endpoint, 
        hasToken: !!token, 
        tokenLength: token.length,
        tokenStart: token.substring(0, 20) + '...'
      })
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    } else {
      console.log('Debug - No token found for request:', endpoint)
    }
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && typeof window !== 'undefined') {
        const refreshToken = localStorage.getItem('refreshToken')
        
        if (refreshToken) {
          try {
            // Try to refresh the token using direct fetch to avoid circular dependency
            const refreshResponse = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            })
            
            const refreshData = await refreshResponse.json()
            
            if (refreshResponse.ok && refreshData.success && refreshData.data) {
              // Store new tokens
              localStorage.setItem('accessToken', refreshData.data.accessToken)
              localStorage.setItem('refreshToken', refreshData.data.refreshToken)
              
              // Retry the original request with new token
              const newToken = refreshData.data.accessToken
              config.headers = {
                ...config.headers,
                Authorization: `Bearer ${newToken}`,
              }
              
              const retryResponse = await fetch(url, config)
              const retryData = await retryResponse.json()
              
              if (retryResponse.ok) {
                return retryData
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            // Refresh failed, clear tokens and redirect to login
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken')
              localStorage.removeItem('refreshToken')
              // Use setTimeout to avoid blocking the current execution
              setTimeout(() => {
                window.location.href = '/auth'
              }, 0)
            }
            throw new ApiError('Authentication failed', 401, data)
          }
        } else {
          // No refresh token, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
            // Use setTimeout to avoid blocking the current execution
            setTimeout(() => {
          window.location.href = '/auth'
            }, 0)
          }
        }
      }

      throw new ApiError(
        data.message || `HTTP ${response.status}`,
        response.status,
        data
      )
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    console.error('API request failed:', error)
    throw new ApiError('Network error', 0, error)
  }
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' }),

  // Authentication methods
  async login(credentials: LoginRequest): Promise<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>> {
    const response = await apiRequest<{ user: any; accessToken: string; refreshToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })

    if (response.success && response.data?.accessToken && response.data?.refreshToken) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', response.data.accessToken)
        localStorage.setItem('refreshToken', response.data.refreshToken)
      }
    }

    return response
  },

  async register(userData: RegisterRequest): Promise<ApiResponse<{ user: any; accessToken: string; refreshToken: string }>> {
    const response = await apiRequest<{ user: any; accessToken: string; refreshToken: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })

    if (response.success && response.data?.accessToken && response.data?.refreshToken) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', response.data.accessToken)
        localStorage.setItem('refreshToken', response.data.refreshToken)
      }
    }

    return response
  },

  async refreshToken(): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new ApiError('No refresh token available', 401)
    }

    const response = await apiRequest<{ accessToken: string; refreshToken: string }>('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })

    if (response.success && response.data) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', response.data.accessToken)
        localStorage.setItem('refreshToken', response.data.refreshToken)
      }
    }

    return response
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await apiRequest<void>('/api/v1/auth/logout', {
      method: 'POST',
    })

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }

    return response
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return apiRequest<void>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      }),
    })
  },

  // User profile methods
  async getUserProfile(): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/users/profile')
  },

  async updateProfile(profileData: any): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    })
  },

  async updateLearningPreferences(preferences: any): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/users/learning-preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
  },

  async updatePrivacySettings(settings: any): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/users/privacy-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  },

  async updateParentalControls(controls: any): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/users/parental-controls', {
      method: 'PUT',
      body: JSON.stringify(controls),
    })
  },

  async deleteAccount(): Promise<ApiResponse<void>> {
    return apiRequest<void>('/api/v1/users/account', {
      method: 'DELETE',
    })
  },

  // Learning path methods
  async getLearningPaths(): Promise<ApiResponse<any[]>> {
    return apiRequest<any[]>('/api/v1/learning-paths')
  },

  async getLearningPath(pathId: string): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/learning-paths/${pathId}`)
  },

  async createLearningPath(pathData: any): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/learning-paths', {
      method: 'POST',
      body: JSON.stringify(pathData),
    })
  },

  async updateLearningPath(pathId: string, pathData: any): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/learning-paths/${pathId}`, {
      method: 'PUT',
      body: JSON.stringify(pathData),
    })
  },

  async updateLearningProgress(pathId: string, progressData: any): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/learning-paths/${pathId}/progress`, {
      method: 'POST',
      body: JSON.stringify(progressData),
    })
  },

  // Progress tracking methods
  async getProgressDashboard(): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/progress/dashboard')
  },

  async getProgressAnalytics(timeframe: string): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/progress/analytics/${timeframe}`)
  },

  async getProgressVisualization(pathId: string): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/progress/visualization/${pathId}`)
  },

  async getUserAchievements(): Promise<ApiResponse<any[]>> {
    return apiRequest<any[]>('/api/v1/progress/achievements')
  },

  async getUserStreaks(): Promise<ApiResponse<any>> {
    return apiRequest<any>('/api/v1/progress/streaks')
  },

  async getUserSkills(): Promise<ApiResponse<any[]>> {
    return apiRequest<any[]>('/api/v1/progress/skills')
  },

  async trackMilestone(pathId: string, milestoneId: string): Promise<ApiResponse<any>> {
    return apiRequest<any>(`/api/v1/progress/milestone/${pathId}/${milestoneId}`, {
      method: 'POST',
    })
  },
}

// API endpoints
export const endpoints = {
  // User endpoints
  users: {
    profile: (userId: string) => `/api/v1/users/${userId}`,
    preferences: (userId: string) => `/api/v1/users/${userId}/preferences`,
    assessment: (userId: string) => `/api/v1/users/${userId}/assessment`,
  },

  // Learning path endpoints
  learningPaths: {
    list: (userId: string) => `/api/v1/users/${userId}/learning-paths`,
    create: (userId: string) => `/api/v1/users/${userId}/learning-paths`,
    get: (pathId: string) => `/api/v1/learning-paths/${pathId}`,
    progress: (pathId: string) => `/api/v1/learning-paths/${pathId}/progress`,
  },

  // Content endpoints
  content: {
    search: '/api/v1/content/search',
    recommendations: (userId: string) => `/api/v1/users/${userId}/recommendations`,
    item: (contentId: string) => `/api/v1/content/${contentId}`,
    bookmark: (userId: string, contentId: string) => `/api/v1/users/${userId}/bookmarks/${contentId}`,
    bookmarks: (userId: string) => `/api/v1/users/${userId}/bookmarks`,
    interaction: (userId: string) => `/api/v1/users/${userId}/interactions`,
    rate: (contentId: string) => `/api/v1/content/${contentId}/rate`,
  },

  // Collaboration endpoints
  collaboration: {
    peers: (userId: string) => `/api/v1/users/${userId}/peer-matches`,
    groups: '/api/v1/study-groups',
    group: (groupId: string) => `/api/v1/study-groups/${groupId}`,
  },

  // Health check
  health: '/api/health',
}