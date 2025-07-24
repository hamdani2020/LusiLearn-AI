// Application constants and configuration values

export const APP_CONFIG = {
  // API Configuration
  API_VERSION: 'v1',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Session Configuration
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  REFRESH_TOKEN_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Learning Configuration
  DEFAULT_SESSION_DURATION: 30, // minutes
  MIN_SESSION_DURATION: 5,
  MAX_SESSION_DURATION: 180,
  TARGET_COMPREHENSION_RATE: 0.75, // 75%
  DIFFICULTY_ADJUSTMENT_THRESHOLD: 0.1,
  
  // Content Configuration
  MAX_CONTENT_RECOMMENDATIONS: 10,
  CONTENT_CACHE_DURATION: 60 * 60 * 1000, // 1 hour
  
  // Collaboration Configuration
  MAX_STUDY_GROUP_SIZE: 8,
  MIN_STUDY_GROUP_SIZE: 2,
  PEER_MATCHING_LIMIT: 5,
  
  // Safety Configuration
  MODERATION_RESPONSE_TIME: 15 * 60 * 1000, // 15 minutes
  CONTENT_REPORT_THRESHOLD: 3,
  
  // AI Configuration
  AI_REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_AI_RETRIES: 3,
  EMBEDDING_DIMENSIONS: 1536, // OpenAI ada-002 dimensions
} as const;

export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'
] as const;

export const SUPPORTED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney'
] as const;

export const CONTENT_SOURCES = {
  YOUTUBE: {
    name: 'YouTube',
    baseUrl: 'https://www.youtube.com',
    apiUrl: 'https://www.googleapis.com/youtube/v3',
    rateLimit: 10000, // requests per day
  },
  KHAN_ACADEMY: {
    name: 'Khan Academy',
    baseUrl: 'https://www.khanacademy.org',
    apiUrl: 'https://www.khanacademy.org/api',
    rateLimit: 1000,
  },
  COURSERA: {
    name: 'Coursera',
    baseUrl: 'https://www.coursera.org',
    apiUrl: 'https://api.coursera.org',
    rateLimit: 500,
  },
  GITHUB: {
    name: 'GitHub',
    baseUrl: 'https://github.com',
    apiUrl: 'https://api.github.com',
    rateLimit: 5000,
  }
} as const;