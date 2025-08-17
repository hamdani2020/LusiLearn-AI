const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
): Promise<T> {
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
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      )
    }

    const data = await response.json()
    return data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
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