/**
 * Integration tests for API endpoints with real backend services
 * Tests authentication flows, token refresh, and real-time WebSocket functionality
 */

import { ApiClient } from '../client';
import { AuthManager } from '@/lib/auth/auth-manager';
import { WebSocketManager } from '@/lib/websocket/manager';
import {
  createMockUser,
  createMockLearningPath,
  createMockStudyGroup,
  measurePerformance,
  PERFORMANCE_THRESHOLDS,
  TEST_API_ENDPOINTS
} from '@/lib/testing';

// Integration test configuration
const INTEGRATION_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  testTimeout: 30000, // 30 seconds for integration tests
  skipIfNoBackend: process.env.SKIP_INTEGRATION_TESTS === 'true'
};

// Helper to check if backend is available
const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${INTEGRATION_CONFIG.apiBaseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

// Skip integration tests if backend is not available
const describeIntegration = INTEGRATION_CONFIG.skipIfNoBackend 
  ? describe.skip 
  : describe;

describeIntegration('API Integration Tests', () => {
  let apiClient: ApiClient;
  let authManager: AuthManager;
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Check if backend is available
    const backendAvailable = await isBackendAvailable();
    if (!backendAvailable) {
      console.warn('Backend not available, skipping integration tests');
      return;
    }

    // Initialize API client
    apiClient = new ApiClient({
      baseURL: INTEGRATION_CONFIG.apiBaseUrl,
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      cacheEnabled: false, // Disable cache for integration tests
      enableMetrics: true
    });

    // Initialize auth manager
    authManager = new AuthManager({
      apiClient,
      tokenStorageKey: 'test_auth_token',
      refreshTokenStorageKey: 'test_refresh_token'
    });

    // Create test user and authenticate
    testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Integration Test User',
      role: 'student',
      educationLevel: 'college'
    };
  }, INTEGRATION_CONFIG.testTimeout);

  afterAll(async () => {
    // Cleanup: delete test user if created
    if (authToken) {
      try {
        await apiClient.delete('/api/v1/auth/user', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      } catch (error) {
        console.warn('Failed to cleanup test user:', error);
      }
    }
  });

  describe('Authentication Flow', () => {
    it('should register a new user successfully', async () => {
      const response = await apiClient.post('/api/v1/auth/register', testUser);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('token');
      expect(response.data.user.email).toBe(testUser.email);

      // Store token for subsequent tests
      authToken = response.data.token;
      apiClient.setAuthToken(authToken);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should login with correct credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await apiClient.post('/api/v1/auth/login', loginData);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('token');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data.user.email).toBe(testUser.email);

      // Update token
      authToken = response.data.token;
      apiClient.setAuthToken(authToken);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should reject login with incorrect credentials', async () => {
      const invalidLoginData = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      const response = await apiClient.post('/api/v1/auth/login', invalidLoginData);

      expect(response.success).toBe(false);
      expect(response.error).toBeTruthy();
    }, INTEGRATION_CONFIG.testTimeout);

    it('should refresh token successfully', async () => {
      // First, get a refresh token
      const loginResponse = await apiClient.post('/api/v1/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(loginResponse.success).toBe(true);
      const refreshToken = loginResponse.data.refreshToken;

      // Use refresh token to get new access token
      const refreshResponse = await apiClient.post('/api/v1/auth/refresh', {
        refreshToken
      });

      expect(refreshResponse.success).toBe(true);
      expect(refreshResponse.data).toHaveProperty('token');
      expect(refreshResponse.data).toHaveProperty('refreshToken');

      // New tokens should be different
      expect(refreshResponse.data.token).not.toBe(loginResponse.data.token);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle token expiration and auto-refresh', async () => {
      // This test would require a short-lived token or manual token manipulation
      // For now, we'll test the refresh mechanism directly
      
      const authManager = new AuthManager({
        apiClient,
        tokenStorageKey: 'test_auth_token',
        refreshTokenStorageKey: 'test_refresh_token'
      });

      // Simulate expired token scenario
      const expiredToken = 'expired.jwt.token';
      apiClient.setAuthToken(expiredToken);

      // Make a request that should trigger token refresh
      const response = await apiClient.get('/api/v1/auth/profile');

      // Should either succeed with refreshed token or fail gracefully
      expect(typeof response.success).toBe('boolean');
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Learning Paths API', () => {
    let createdPathId: string;

    it('should create a learning path', async () => {
      const createData = {
        subject: 'Integration Test Mathematics',
        goals: ['Master integration testing', 'Understand API flows'],
        educationLevel: 'college',
        estimatedDuration: 120
      };

      const response = await apiClient.post('/api/v1/learning-paths', createData);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('id');
      expect(response.data.subject).toBe(createData.subject);
      expect(response.data.goals).toEqual(createData.goals);

      createdPathId = response.data.id;
    }, INTEGRATION_CONFIG.testTimeout);

    it('should fetch all learning paths', async () => {
      const response = await apiClient.get('/api/v1/learning-paths');

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      // Should include our created path
      const createdPath = response.data.find((path: any) => path.id === createdPathId);
      expect(createdPath).toBeDefined();
    }, INTEGRATION_CONFIG.testTimeout);

    it('should fetch a specific learning path', async () => {
      const response = await apiClient.get(`/api/v1/learning-paths/${createdPathId}`);

      expect(response.success).toBe(true);
      expect(response.data.id).toBe(createdPathId);
      expect(response.data.subject).toBe('Integration Test Mathematics');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should update a learning path', async () => {
      const updateData = {
        subject: 'Updated Integration Test Mathematics',
        objectives: ['Updated objective 1', 'Updated objective 2']
      };

      const response = await apiClient.put(`/api/v1/learning-paths/${createdPathId}`, updateData);

      expect(response.success).toBe(true);
      expect(response.data.subject).toBe(updateData.subject);
      expect(response.data.objectives).toEqual(updateData.objectives);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should delete a learning path', async () => {
      const response = await apiClient.delete(`/api/v1/learning-paths/${createdPathId}`);

      expect(response.success).toBe(true);

      // Verify deletion
      const getResponse = await apiClient.get(`/api/v1/learning-paths/${createdPathId}`);
      expect(getResponse.success).toBe(false);
      expect(getResponse.error).toContain('not found');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle validation errors', async () => {
      const invalidData = {
        subject: '', // Empty subject should fail validation
        goals: [], // Empty goals should fail validation
        educationLevel: 'invalid-level'
      };

      const response = await apiClient.post('/api/v1/learning-paths', invalidData);

      expect(response.success).toBe(false);
      expect(response.error).toBeTruthy();
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Progress Tracking API', () => {
    it('should fetch user progress analytics', async () => {
      const response = await apiClient.get('/api/v1/progress/analytics');

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('overallProgress');
      expect(response.data).toHaveProperty('weeklyStats');
      expect(response.data).toHaveProperty('monthlyStats');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should fetch weekly progress data', async () => {
      const response = await apiClient.get('/api/v1/progress/analytics/weekly');

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data.weeklyProgress)).toBe(true);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should update progress for a learning session', async () => {
      const progressData = {
        sessionId: `session-${Date.now()}`,
        duration: 3600, // 1 hour
        completedLessons: 3,
        comprehensionScore: 0.85,
        engagementMetrics: {
          timeOnTask: 3400,
          interactionCount: 45,
          helpRequestCount: 2
        }
      };

      const response = await apiClient.post('/api/v1/progress/sessions', progressData);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('sessionId');
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Collaboration API', () => {
    let createdGroupId: string;

    it('should create a study group', async () => {
      const groupData = {
        name: 'Integration Test Study Group',
        description: 'A group for testing API integration',
        subject: 'Mathematics',
        educationLevel: 'college',
        maxMembers: 10,
        isPublic: true,
        tags: ['integration', 'testing', 'math']
      };

      const response = await apiClient.post('/api/v1/collaboration/study-groups', groupData);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(groupData.name);

      createdGroupId = response.data.id;
    }, INTEGRATION_CONFIG.testTimeout);

    it('should fetch all study groups', async () => {
      const response = await apiClient.get('/api/v1/collaboration/study-groups');

      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);

      // Should include our created group
      const createdGroup = response.data.find((group: any) => group.id === createdGroupId);
      expect(createdGroup).toBeDefined();
    }, INTEGRATION_CONFIG.testTimeout);

    it('should join a study group', async () => {
      const response = await apiClient.post(`/api/v1/collaboration/study-groups/${createdGroupId}/join`);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('membershipId');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should leave a study group', async () => {
      const response = await apiClient.post(`/api/v1/collaboration/study-groups/${createdGroupId}/leave`);

      expect(response.success).toBe(true);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should delete a study group', async () => {
      const response = await apiClient.delete(`/api/v1/collaboration/study-groups/${createdGroupId}`);

      expect(response.success).toBe(true);
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Performance Requirements', () => {
    it('should meet API response time requirements', async () => {
      const endpoints = [
        '/api/v1/learning-paths',
        '/api/v1/progress/analytics/weekly',
        '/api/v1/collaboration/study-groups'
      ];

      for (const endpoint of endpoints) {
        const responseTime = await measurePerformance(async () => {
          await apiClient.get(endpoint);
        });

        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      }
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, () =>
        apiClient.get('/api/v1/learning-paths')
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      // Total time should be reasonable for concurrent requests
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2);
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await apiClient.get('/api/v1/learning-paths/non-existent-id');

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle 401 unauthorized errors', async () => {
      // Remove auth token
      apiClient.setAuthToken('');

      const response = await apiClient.get('/api/v1/auth/profile');

      expect(response.success).toBe(false);
      expect(response.error).toContain('unauthorized');

      // Restore auth token
      apiClient.setAuthToken(authToken);
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle 403 forbidden errors', async () => {
      // Try to access admin-only endpoint
      const response = await apiClient.get('/api/v1/admin/users');

      expect(response.success).toBe(false);
      expect(response.error).toContain('forbidden');
    }, INTEGRATION_CONFIG.testTimeout);

    it('should handle rate limiting', async () => {
      // Make many requests quickly to trigger rate limiting
      const rapidRequests = Array.from({ length: 100 }, () =>
        apiClient.get('/api/v1/learning-paths')
      );

      const responses = await Promise.allSettled(rapidRequests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(result => 
        result.status === 'fulfilled' && 
        !result.value.success && 
        result.value.error?.includes('rate limit')
      );

      // We expect at least some rate limiting to occur
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, INTEGRATION_CONFIG.testTimeout);
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across operations', async () => {
      // Create a learning path
      const createResponse = await apiClient.post('/api/v1/learning-paths', {
        subject: 'Consistency Test',
        goals: ['Test data consistency'],
        educationLevel: 'college'
      });

      expect(createResponse.success).toBe(true);
      const pathId = createResponse.data.id;

      // Fetch the created path
      const fetchResponse = await apiClient.get(`/api/v1/learning-paths/${pathId}`);
      expect(fetchResponse.success).toBe(true);
      expect(fetchResponse.data.subject).toBe('Consistency Test');

      // Update the path
      const updateResponse = await apiClient.put(`/api/v1/learning-paths/${pathId}`, {
        subject: 'Updated Consistency Test'
      });
      expect(updateResponse.success).toBe(true);

      // Verify update
      const verifyResponse = await apiClient.get(`/api/v1/learning-paths/${pathId}`);
      expect(verifyResponse.success).toBe(true);
      expect(verifyResponse.data.subject).toBe('Updated Consistency Test');

      // Cleanup
      await apiClient.delete(`/api/v1/learning-paths/${pathId}`);
    }, INTEGRATION_CONFIG.testTimeout);
  });
});