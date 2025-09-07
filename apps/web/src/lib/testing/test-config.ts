/**
 * Test configuration and constants
 * Centralized configuration for all testing scenarios
 */

export interface TestConfig {
  apiBaseUrl: string;
  mockServerPort: number;
  testTimeout: number;
  retryAttempts: number;
  parallelTests: boolean;
  coverage: {
    threshold: number;
    includePatterns: string[];
    excludePatterns: string[];
  };
  performance: {
    maxResponseTime: number;
    maxRenderTime: number;
    maxHookUpdateTime: number;
  };
  websocket: {
    connectionTimeout: number;
    reconnectAttempts: number;
    heartbeatInterval: number;
  };
}

export const defaultTestConfig: TestConfig = {
  apiBaseUrl: 'http://localhost:4000',
  mockServerPort: 4001,
  testTimeout: 10000,
  retryAttempts: 3,
  parallelTests: true,
  coverage: {
    threshold: 85,
    includePatterns: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.stories.{ts,tsx}',
      '!src/**/*.test.{ts,tsx}'
    ],
    excludePatterns: [
      'src/lib/testing/**',
      'src/**/__tests__/**',
      'src/**/*.mock.{ts,tsx}'
    ]
  },
  performance: {
    maxResponseTime: 2000,
    maxRenderTime: 100,
    maxHookUpdateTime: 50
  },
  websocket: {
    connectionTimeout: 5000,
    reconnectAttempts: 3,
    heartbeatInterval: 30000
  }
};

// Test environment detection
export const isTestEnvironment = () => process.env.NODE_ENV === 'test';
export const isCI = () => process.env.CI === 'true';
export const isDebugMode = () => process.env.DEBUG_TESTS === 'true';

// Test data constants
export const TEST_USER_ID = 'test-user-1';
export const TEST_LEARNING_PATH_ID = 'test-path-1';
export const TEST_STUDY_GROUP_ID = 'test-group-1';

export const TEST_API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    PROFILE: '/api/v1/auth/profile'
  },
  LEARNING_PATHS: {
    LIST: '/api/v1/learning-paths',
    GET: (id: string) => `/api/v1/learning-paths/${id}`,
    CREATE: '/api/v1/learning-paths',
    UPDATE: (id: string) => `/api/v1/learning-paths/${id}`,
    DELETE: (id: string) => `/api/v1/learning-paths/${id}`
  },
  PROGRESS: {
    ANALYTICS: '/api/v1/progress/analytics',
    WEEKLY: '/api/v1/progress/analytics/weekly',
    MONTHLY: '/api/v1/progress/analytics/monthly'
  },
  COLLABORATION: {
    STUDY_GROUPS: '/api/v1/collaboration/study-groups',
    JOIN_GROUP: (id: string) => `/api/v1/collaboration/study-groups/${id}/join`,
    LEAVE_GROUP: (id: string) => `/api/v1/collaboration/study-groups/${id}/leave`
  }
};

// Mock data templates
export const MOCK_RESPONSES = {
  SUCCESS: {
    success: true,
    metadata: {
      requestId: 'test-request-id',
      timestamp: '2024-01-01T00:00:00Z',
      duration: 100,
      cached: false
    }
  },
  ERROR: {
    success: false,
    error: 'Test error',
    message: 'Test error message',
    metadata: {
      requestId: 'test-request-id',
      timestamp: '2024-01-01T00:00:00Z',
      duration: 50,
      cached: false
    }
  }
};

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 2000, // 2 seconds
  COMPONENT_RENDER_TIME: 100, // 100ms
  HOOK_UPDATE_TIME: 50, // 50ms
  WEBSOCKET_CONNECTION_TIME: 1000, // 1 second
  CACHE_ACCESS_TIME: 10 // 10ms
};

// Error simulation scenarios
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  AUTHENTICATION_ERROR: 'auth_error',
  VALIDATION_ERROR: 'validation_error',
  SERVER_ERROR: 'server_error'
};

// WebSocket message types for testing
export const WEBSOCKET_MESSAGE_TYPES = {
  COLLABORATION: {
    JOIN: 'collaboration:join',
    LEAVE: 'collaboration:leave',
    MESSAGE: 'collaboration:message',
    SCREEN_SHARE: 'collaboration:screen-share'
  },
  PROGRESS: {
    UPDATE: 'progress:update',
    MILESTONE: 'progress:milestone',
    ACHIEVEMENT: 'progress:achievement'
  },
  NOTIFICATION: {
    INFO: 'notification:info',
    WARNING: 'notification:warning',
    ERROR: 'notification:error'
  }
};