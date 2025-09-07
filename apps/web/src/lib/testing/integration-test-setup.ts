/**
 * Integration test setup configuration
 * Configures real backend connections and test data management
 */

import { ApiClient } from '@/lib/api-client/client';

// Integration test configuration
const INTEGRATION_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  testTimeout: 30000,
  skipIfNoBackend: process.env.SKIP_INTEGRATION_TESTS === 'true'
};

// Global test client for integration tests
let testApiClient: ApiClient;
let testUserId: string | null = null;
let testAuthToken: string | null = null;

// Helper to check if backend is available
const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${INTEGRATION_CONFIG.apiBaseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

// Setup integration test environment
beforeAll(async () => {
  if (INTEGRATION_CONFIG.skipIfNoBackend) {
    console.log('Skipping integration tests - backend not available');
    return;
  }

  // Check backend availability
  const backendAvailable = await isBackendAvailable();
  if (!backendAvailable) {
    console.warn('Backend not available for integration tests');
    return;
  }

  // Initialize test API client
  testApiClient = new ApiClient({
    baseURL: INTEGRATION_CONFIG.apiBaseUrl,
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 1000,
    cacheEnabled: false, // Disable cache for integration tests
    enableMetrics: true
  });

  // Create test user for integration tests
  const testUser = {
    email: `integration-test-${Date.now()}@example.com`,
    password: 'IntegrationTest123!',
    name: 'Integration Test User',
    role: 'student',
    educationLevel: 'college'
  };

  try {
    const registerResponse = await testApiClient.post('/api/v1/auth/register', testUser);
    if (registerResponse.success) {
      testUserId = registerResponse.data.user.id;
      testAuthToken = registerResponse.data.token;
      testApiClient.setAuthToken(testAuthToken);
    }
  } catch (error) {
    console.warn('Failed to create test user for integration tests:', error);
  }
}, 60000); // 1 minute timeout for setup

// Cleanup integration test environment
afterAll(async () => {
  if (testApiClient && testAuthToken) {
    try {
      // Delete test user
      await testApiClient.delete('/api/v1/auth/user');
    } catch (error) {
      console.warn('Failed to cleanup test user:', error);
    }
  }
}, 30000);

// Reset test data between tests
beforeEach(async () => {
  if (!testApiClient || !testAuthToken) {
    return;
  }

  try {
    // Clean up any test data created in previous tests
    await cleanupTestData();
  } catch (error) {
    console.warn('Failed to cleanup test data:', error);
  }
});

// Cleanup test data
const cleanupTestData = async () => {
  if (!testApiClient) return;

  try {
    // Delete test learning paths
    const pathsResponse = await testApiClient.get('/api/v1/learning-paths');
    if (pathsResponse.success && pathsResponse.data) {
      for (const path of pathsResponse.data) {
        if (path.subject?.includes('Test') || path.subject?.includes('Integration')) {
          await testApiClient.delete(`/api/v1/learning-paths/${path.id}`);
        }
      }
    }

    // Delete test study groups
    const groupsResponse = await testApiClient.get('/api/v1/collaboration/study-groups');
    if (groupsResponse.success && groupsResponse.data) {
      for (const group of groupsResponse.data) {
        if (group.name?.includes('Test') || group.name?.includes('Integration')) {
          await testApiClient.delete(`/api/v1/collaboration/study-groups/${group.id}`);
        }
      }
    }
  } catch (error) {
    console.warn('Error during test data cleanup:', error);
  }
};

// Test utilities for integration tests
export const getTestApiClient = (): ApiClient => {
  if (!testApiClient) {
    throw new Error('Test API client not initialized. Backend may not be available.');
  }
  return testApiClient;
};

export const getTestUserId = (): string => {
  if (!testUserId) {
    throw new Error('Test user not created. Backend may not be available.');
  }
  return testUserId;
};

export const getTestAuthToken = (): string => {
  if (!testAuthToken) {
    throw new Error('Test auth token not available. Backend may not be available.');
  }
  return testAuthToken;
};

// Create test data helpers
export const createTestLearningPath = async (overrides: any = {}) => {
  const client = getTestApiClient();
  
  const pathData = {
    subject: 'Integration Test Subject',
    goals: ['Test goal 1', 'Test goal 2'],
    educationLevel: 'college',
    estimatedDuration: 120,
    ...overrides
  };

  const response = await client.post('/api/v1/learning-paths', pathData);
  if (!response.success) {
    throw new Error(`Failed to create test learning path: ${response.error}`);
  }
  
  return response.data;
};

export const createTestStudyGroup = async (overrides: any = {}) => {
  const client = getTestApiClient();
  
  const groupData = {
    name: 'Integration Test Study Group',
    description: 'A group for integration testing',
    subject: 'Mathematics',
    educationLevel: 'college',
    maxMembers: 10,
    isPublic: true,
    tags: ['integration', 'testing'],
    ...overrides
  };

  const response = await client.post('/api/v1/collaboration/study-groups', groupData);
  if (!response.success) {
    throw new Error(`Failed to create test study group: ${response.error}`);
  }
  
  return response.data;
};

export const createTestProgressSession = async (overrides: any = {}) => {
  const client = getTestApiClient();
  
  const sessionData = {
    sessionId: `integration-test-session-${Date.now()}`,
    duration: 3600,
    completedLessons: 3,
    comprehensionScore: 0.85,
    engagementMetrics: {
      timeOnTask: 3400,
      interactionCount: 45,
      helpRequestCount: 2
    },
    ...overrides
  };

  const response = await client.post('/api/v1/progress/sessions', sessionData);
  if (!response.success) {
    throw new Error(`Failed to create test progress session: ${response.error}`);
  }
  
  return response.data;
};

// Database helpers for integration tests
export const waitForDatabaseSync = async (timeout = 5000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await getTestApiClient().get('/api/v1/health/database');
      if (response.success) {
        return;
      }
    } catch (error) {
      // Continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Database sync timeout');
};

// WebSocket helpers for integration tests
export const createTestWebSocketConnection = async () => {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(INTEGRATION_CONFIG.wsUrl);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      resolve(ws);
    };

    ws.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
  });
};

// Performance monitoring for integration tests
export const measureIntegrationTestPerformance = async (
  testName: string,
  testFunction: () => Promise<void>
) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    await testFunction();
  } finally {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    const metrics = {
      testName,
      duration: endTime - startTime,
      memoryDelta: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal
      }
    };
    
    console.log(`Integration test performance [${testName}]:`, metrics);
    
    // Log warning if test is slow
    if (metrics.duration > 10000) {
      console.warn(`Slow integration test detected: ${testName} took ${metrics.duration}ms`);
    }
  }
};

// Skip integration tests if backend is not available
export const skipIfNoBackend = () => {
  if (INTEGRATION_CONFIG.skipIfNoBackend || !testApiClient) {
    return test.skip;
  }
  return test;
};

// Export configuration for use in tests
export { INTEGRATION_CONFIG };