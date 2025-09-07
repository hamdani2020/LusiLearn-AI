/**
 * End-to-end tests for critical user journeys with API integrations
 * Tests complete user flows from frontend to backend with error scenarios
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const E2E_CONFIG = {
  testTimeout: 60000, // 1 minute per test
  apiTimeout: 10000,  // 10 seconds for API calls
  retryAttempts: 2
};

// Test data
const TEST_USER = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'E2ETestPassword123!',
  name: 'E2E Test User',
  role: 'student',
  educationLevel: 'college'
};

// Helper functions
class E2ETestHelpers {
  constructor(private page: Page) {}

  async waitForApiResponse(endpoint: string, timeout = E2E_CONFIG.apiTimeout) {
    return this.page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() < 400,
      { timeout }
    );
  }

  async waitForApiError(endpoint: string, timeout = E2E_CONFIG.apiTimeout) {
    return this.page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() >= 400,
      { timeout }
    );
  }

  async loginUser(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    
    const loginPromise = this.waitForApiResponse('/api/v1/auth/login');
    await this.page.click('[data-testid="login-button"]');
    await loginPromise;
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/dashboard');
  }

  async registerUser(userData: typeof TEST_USER) {
    await this.page.goto('/register');
    await this.page.fill('[data-testid="name-input"]', userData.name);
    await this.page.fill('[data-testid="email-input"]', userData.email);
    await this.page.fill('[data-testid="password-input"]', userData.password);
    await this.page.selectOption('[data-testid="role-select"]', userData.role);
    await this.page.selectOption('[data-testid="education-level-select"]', userData.educationLevel);
    
    const registerPromise = this.waitForApiResponse('/api/v1/auth/register');
    await this.page.click('[data-testid="register-button"]');
    await registerPromise;
  }

  async createLearningPath(subject: string, goals: string[]) {
    await this.page.goto('/learning-paths');
    await this.page.click('[data-testid="create-learning-path-button"]');
    
    await this.page.fill('[data-testid="subject-input"]', subject);
    
    // Add goals
    for (const goal of goals) {
      await this.page.click('[data-testid="add-goal-button"]');
      await this.page.fill('[data-testid="goal-input"]:last-child', goal);
    }
    
    const createPromise = this.waitForApiResponse('/api/v1/learning-paths');
    await this.page.click('[data-testid="create-path-button"]');
    await createPromise;
    
    // Wait for redirect back to learning paths list
    await this.page.waitForURL('/learning-paths');
  }

  async mockApiEndpoint(endpoint: string, response: any, status = 200) {
    await this.page.route(`**${endpoint}`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  async takeScreenshotOnFailure(testName: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${testName}-failure.png`,
      fullPage: true 
    });
  }
}

test.describe('API Integration User Journeys', () => {
  let helpers: E2ETestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new E2ETestHelpers(page);
    
    // Set longer timeout for E2E tests
    test.setTimeout(E2E_CONFIG.testTimeout);
  });

  test.describe('Authentication Flow', () => {
    test('should complete full registration and login flow', async ({ page }) => {
      // Register new user
      await helpers.registerUser(TEST_USER);
      
      // Should be redirected to dashboard after registration
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="welcome-message"]')).toContainText(TEST_USER.name);
      
      // Logout
      await page.click('[data-testid="user-menu"]');
      const logoutPromise = helpers.waitForApiResponse('/api/v1/auth/logout');
      await page.click('[data-testid="logout-button"]');
      await logoutPromise;
      
      // Should be redirected to login page
      await expect(page).toHaveURL('/login');
      
      // Login with same credentials
      await helpers.loginUser(TEST_USER.email, TEST_USER.password);
      
      // Should be back on dashboard
      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="welcome-message"]')).toContainText(TEST_USER.name);
    });

    test('should handle login errors gracefully', async ({ page }) => {
      await page.goto('/login');
      
      // Try to login with invalid credentials
      await page.fill('[data-testid="email-input"]', 'invalid@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      
      const errorPromise = helpers.waitForApiError('/api/v1/auth/login');
      await page.click('[data-testid="login-button"]');
      await errorPromise;
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
      
      // Should remain on login page
      await expect(page).toHaveURL('/login');
    });

    test('should handle network errors during authentication', async ({ page }) => {
      // Mock network error
      await helpers.mockApiEndpoint('/api/v1/auth/login', {}, 0); // Network error
      
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', TEST_USER.email);
      await page.fill('[data-testid="password-input"]', TEST_USER.password);
      await page.click('[data-testid="login-button"]');
      
      // Should show network error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('network');
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
  });

  test.describe('Learning Paths Management', () => {
    test.beforeEach(async ({ page }) => {
      // Register and login user for each test
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-paths-${Date.now()}@example.com`
      });
    });

    test('should create, view, edit, and delete learning paths', async ({ page }) => {
      const pathSubject = 'E2E Test Mathematics';
      const pathGoals = ['Master calculus', 'Understand linear algebra'];
      
      // Create learning path
      await helpers.createLearningPath(pathSubject, pathGoals);
      
      // Verify path appears in list
      await expect(page.locator('[data-testid="learning-path-item"]')).toContainText(pathSubject);
      
      // View path details
      await page.click('[data-testid="view-path-button"]');
      await expect(page.locator('[data-testid="path-subject"]')).toContainText(pathSubject);
      await expect(page.locator('[data-testid="path-goals"]')).toContainText(pathGoals[0]);
      
      // Edit path
      await page.click('[data-testid="edit-path-button"]');
      const updatedSubject = 'Updated E2E Test Mathematics';
      await page.fill('[data-testid="subject-input"]', updatedSubject);
      
      const updatePromise = helpers.waitForApiResponse('/api/v1/learning-paths');
      await page.click('[data-testid="save-path-button"]');
      await updatePromise;
      
      // Verify update
      await expect(page.locator('[data-testid="path-subject"]')).toContainText(updatedSubject);
      
      // Delete path
      await page.click('[data-testid="delete-path-button"]');
      await page.click('[data-testid="confirm-delete-button"]');
      
      const deletePromise = helpers.waitForApiResponse('/api/v1/learning-paths');
      await deletePromise;
      
      // Verify deletion
      await page.goto('/learning-paths');
      await expect(page.locator('[data-testid="learning-path-item"]')).not.toContainText(updatedSubject);
    });

    test('should handle learning path creation errors', async ({ page }) => {
      await page.goto('/learning-paths');
      await page.click('[data-testid="create-learning-path-button"]');
      
      // Try to create path with empty subject
      await page.fill('[data-testid="subject-input"]', '');
      await page.click('[data-testid="create-path-button"]');
      
      // Should show validation error
      await expect(page.locator('[data-testid="subject-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="subject-error"]')).toContainText('required');
    });

    test('should show loading states during API calls', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Should show loading spinner while fetching paths
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // Wait for paths to load
      await helpers.waitForApiResponse('/api/v1/learning-paths');
      
      // Loading spinner should disappear
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });
  });

  test.describe('Progress Tracking', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-progress-${Date.now()}@example.com`
      });
    });

    test('should display progress analytics', async ({ page }) => {
      await page.goto('/progress');
      
      // Wait for analytics data to load
      await helpers.waitForApiResponse('/api/v1/progress/analytics');
      
      // Should show progress dashboard
      await expect(page.locator('[data-testid="progress-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="overall-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="weekly-stats"]')).toBeVisible();
    });

    test('should handle progress data loading errors', async ({ page }) => {
      // Mock API error
      await helpers.mockApiEndpoint('/api/v1/progress/analytics', {
        success: false,
        error: 'Failed to load progress data'
      }, 500);
      
      await page.goto('/progress');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load');
      
      // Should show retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
  });

  test.describe('Study Groups and Collaboration', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-collab-${Date.now()}@example.com`
      });
    });

    test('should create and join study groups', async ({ page }) => {
      await page.goto('/study-groups');
      
      // Create new study group
      await page.click('[data-testid="create-group-button"]');
      await page.fill('[data-testid="group-name-input"]', 'E2E Test Study Group');
      await page.fill('[data-testid="group-description-input"]', 'A group for testing');
      await page.selectOption('[data-testid="subject-select"]', 'Mathematics');
      
      const createPromise = helpers.waitForApiResponse('/api/v1/collaboration/study-groups');
      await page.click('[data-testid="create-group-submit"]');
      await createPromise;
      
      // Should be redirected to group page
      await expect(page.locator('[data-testid="group-name"]')).toContainText('E2E Test Study Group');
      
      // Should show as group creator/member
      await expect(page.locator('[data-testid="member-status"]')).toContainText('Creator');
    });

    test('should handle real-time collaboration features', async ({ page, context }) => {
      // This test would require WebSocket functionality
      // For now, we'll test the UI components
      
      await page.goto('/study-groups');
      
      // Mock existing group
      await helpers.mockApiEndpoint('/api/v1/collaboration/study-groups', {
        success: true,
        data: [{
          id: 'test-group-1',
          name: 'Test Group',
          subject: 'Mathematics',
          currentMembers: 3,
          maxMembers: 10
        }]
      });
      
      await page.reload();
      
      // Join existing group
      await page.click('[data-testid="join-group-button"]');
      
      const joinPromise = helpers.waitForApiResponse('/api/v1/collaboration/study-groups/test-group-1/join');
      await joinPromise;
      
      // Should show joined status
      await expect(page.locator('[data-testid="member-status"]')).toContainText('Member');
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-errors-${Date.now()}@example.com`
      });
    });

    test('should recover from temporary network failures', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Wait for initial load
      await helpers.waitForApiResponse('/api/v1/learning-paths');
      
      // Mock network failure
      await helpers.mockApiEndpoint('/api/v1/learning-paths', {}, 0);
      
      // Try to refresh data
      await page.click('[data-testid="refresh-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      
      // Remove mock to simulate network recovery
      await page.unroute('**/api/v1/learning-paths');
      
      // Retry should work
      await page.click('[data-testid="retry-button"]');
      await helpers.waitForApiResponse('/api/v1/learning-paths');
      
      // Error message should disappear
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });

    test('should handle session expiration gracefully', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Mock 401 unauthorized response
      await helpers.mockApiEndpoint('/api/v1/learning-paths', {
        success: false,
        error: 'Token expired'
      }, 401);
      
      await page.goto('/learning-paths');
      
      // Should redirect to login page
      await expect(page).toHaveURL('/login');
      
      // Should show session expired message
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });

    test('should handle server errors with user-friendly messages', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Mock server error
      await helpers.mockApiEndpoint('/api/v1/learning-paths', {
        success: false,
        error: 'Internal server error'
      }, 500);
      
      await page.reload();
      
      // Should show user-friendly error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('something went wrong');
      await expect(page.locator('[data-testid="error-message"]')).not.toContainText('Internal server error');
    });
  });

  test.describe('Performance Requirements', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-perf-${Date.now()}@example.com`
      });
    });

    test('should meet page load performance requirements', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/dashboard');
      await helpers.waitForApiResponse('/api/v1/auth/profile');
      
      const loadTime = Date.now() - startTime;
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Core Web Vitals checks
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const metrics = entries.reduce((acc, entry) => {
              acc[entry.name] = entry.value;
              return acc;
            }, {} as Record<string, number>);
            resolve(metrics);
          }).observe({ entryTypes: ['measure', 'navigation'] });
        });
      });
      
      console.log('Performance metrics:', performanceMetrics);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      const largeLearningPaths = Array.from({ length: 100 }, (_, i) => ({
        id: `path-${i}`,
        subject: `Subject ${i}`,
        currentLevel: 'intermediate',
        objectives: [`Objective ${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      await helpers.mockApiEndpoint('/api/v1/learning-paths', {
        success: true,
        data: largeLearningPaths
      });
      
      const startTime = Date.now();
      await page.goto('/learning-paths');
      
      // Wait for all items to be rendered
      await expect(page.locator('[data-testid="learning-path-item"]')).toHaveCount(100);
      
      const renderTime = Date.now() - startTime;
      
      // Should render 100 items within reasonable time
      expect(renderTime).toBeLessThan(5000);
      
      // Should implement virtual scrolling or pagination for performance
      const visibleItems = await page.locator('[data-testid="learning-path-item"]:visible').count();
      expect(visibleItems).toBeLessThanOrEqual(20); // Should not render all items at once
    });
  });

  test.describe('Accessibility and Usability', () => {
    test.beforeEach(async ({ page }) => {
      await helpers.registerUser({
        ...TEST_USER,
        email: `e2e-a11y-${Date.now()}@example.com`
      });
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/learning-paths');
      await helpers.waitForApiResponse('/api/v1/learning-paths');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab'); // Create button
      await expect(page.locator('[data-testid="create-learning-path-button"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // First path item
      await expect(page.locator('[data-testid="learning-path-item"]:first-child')).toBeFocused();
      
      // Enter should activate focused element
      await page.keyboard.press('Enter');
      // Should navigate to path details or open context menu
    });

    test('should provide proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Check for proper ARIA attributes
      await expect(page.locator('[data-testid="create-learning-path-button"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="learning-paths-list"]')).toHaveAttribute('role', 'list');
      
      // Loading states should be announced
      const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
      if (await loadingSpinner.isVisible()) {
        await expect(loadingSpinner).toHaveAttribute('aria-label', /loading/i);
      }
    });

    test('should work with screen reader announcements', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Create a learning path
      await page.click('[data-testid="create-learning-path-button"]');
      await page.fill('[data-testid="subject-input"]', 'Accessibility Test');
      await page.click('[data-testid="add-goal-button"]');
      await page.fill('[data-testid="goal-input"]', 'Test accessibility');
      
      const createPromise = helpers.waitForApiResponse('/api/v1/learning-paths');
      await page.click('[data-testid="create-path-button"]');
      await createPromise;
      
      // Success message should be announced
      await expect(page.locator('[data-testid="success-message"]')).toHaveAttribute('role', 'alert');
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });
  });

  // Error handling for failed tests
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await helpers.takeScreenshotOnFailure(testInfo.title);
      
      // Log console errors
      const logs = await page.evaluate(() => {
        return (window as any).testLogs || [];
      });
      
      if (logs.length > 0) {
        console.log('Console logs during test:', logs);
      }
    }
  });
});