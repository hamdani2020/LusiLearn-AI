/**
 * Performance-focused end-to-end tests
 * Tests API response times, rendering performance, and user experience metrics
 */

import { test, expect, Page } from '@playwright/test';

// Performance test configuration
const PERF_CONFIG = {
  maxPageLoadTime: 3000,      // 3 seconds
  maxApiResponseTime: 2000,   // 2 seconds
  maxRenderTime: 1000,        // 1 second
  maxInteractionTime: 500,    // 500ms
  testTimeout: 120000         // 2 minutes for performance tests
};

// Performance measurement utilities
class PerformanceTestHelpers {
  constructor(private page: Page) {}

  async measurePageLoad(url: string): Promise<number> {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
    return Date.now() - startTime;
  }

  async measureApiCall(endpoint: string): Promise<number> {
    const startTime = Date.now();
    await this.page.waitForResponse(response => 
      response.url().includes(endpoint) && response.status() < 400
    );
    return Date.now() - startTime;
  }

  async measureInteraction(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
  }

  async getWebVitals(): Promise<Record<string, number>> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: Record<string, number> = {};
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.LCP = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            vitals.FID = entry.processingStart - entry.startTime;
          });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          vitals.CLS = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // Time to First Byte
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
          vitals.TTFB = navigationEntry.responseStart - navigationEntry.requestStart;
        }

        setTimeout(() => resolve(vitals), 3000);
      });
    });
  }

  async measureMemoryUsage(): Promise<any> {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
  }

  async simulateSlowNetwork() {
    await this.page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      route.continue();
    });
  }

  async simulateSlowCPU() {
    await this.page.addInitScript(() => {
      // Simulate slow CPU by adding computational load
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(callback, delay, ...args) {
        return originalSetTimeout(() => {
          // Add some CPU work
          let sum = 0;
          for (let i = 0; i < 10000; i++) {
            sum += Math.random();
          }
          callback.apply(this, args);
        }, delay);
      };
    });
  }
}

test.describe('Performance Tests', () => {
  let perfHelpers: PerformanceTestHelpers;

  test.beforeEach(async ({ page }) => {
    perfHelpers = new PerformanceTestHelpers(page);
    test.setTimeout(PERF_CONFIG.testTimeout);

    // Register test user for performance tests
    await page.goto('/register');
    const testUser = {
      name: 'Performance Test User',
      email: `perf-test-${Date.now()}@example.com`,
      password: 'PerfTest123!',
      role: 'student',
      educationLevel: 'college'
    };

    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.selectOption('[data-testid="role-select"]', testUser.role);
    await page.selectOption('[data-testid="education-level-select"]', testUser.educationLevel);
    await page.click('[data-testid="register-button"]');
    
    await page.waitForURL('/dashboard');
  });

  test.describe('Page Load Performance', () => {
    test('dashboard should load within performance budget', async ({ page }) => {
      const loadTime = await perfHelpers.measurePageLoad('/dashboard');
      
      expect(loadTime).toBeLessThan(PERF_CONFIG.maxPageLoadTime);
      
      // Check Web Vitals
      const vitals = await perfHelpers.getWebVitals();
      
      // Largest Contentful Paint should be under 2.5s
      if (vitals.LCP) {
        expect(vitals.LCP).toBeLessThan(2500);
      }
      
      // First Input Delay should be under 100ms
      if (vitals.FID) {
        expect(vitals.FID).toBeLessThan(100);
      }
      
      // Cumulative Layout Shift should be under 0.1
      if (vitals.CLS) {
        expect(vitals.CLS).toBeLessThan(0.1);
      }
      
      // Time to First Byte should be under 600ms
      if (vitals.TTFB) {
        expect(vitals.TTFB).toBeLessThan(600);
      }
    });

    test('learning paths page should load efficiently', async ({ page }) => {
      const loadTime = await perfHelpers.measurePageLoad('/learning-paths');
      
      expect(loadTime).toBeLessThan(PERF_CONFIG.maxPageLoadTime);
      
      // Should show loading state immediately
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      // API call should complete quickly
      const apiTime = await perfHelpers.measureApiCall('/api/v1/learning-paths');
      expect(apiTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
    });

    test('progress analytics page should handle data visualization efficiently', async ({ page }) => {
      const loadTime = await perfHelpers.measurePageLoad('/progress');
      
      expect(loadTime).toBeLessThan(PERF_CONFIG.maxPageLoadTime);
      
      // Wait for charts to render
      await page.waitForSelector('[data-testid="progress-chart"]');
      
      // Memory usage should be reasonable
      const memoryUsage = await perfHelpers.measureMemoryUsage();
      if (memoryUsage) {
        // Should use less than 50MB for charts
        expect(memoryUsage.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024);
      }
    });
  });

  test.describe('API Response Performance', () => {
    test('learning paths CRUD operations should be fast', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Create operation
      await page.click('[data-testid="create-learning-path-button"]');
      await page.fill('[data-testid="subject-input"]', 'Performance Test Subject');
      await page.click('[data-testid="add-goal-button"]');
      await page.fill('[data-testid="goal-input"]', 'Test performance');
      
      const createTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="create-path-button"]');
        await page.waitForURL('/learning-paths');
      });
      
      expect(createTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
      
      // Read operation
      const readTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="view-path-button"]:first-child');
        await page.waitForSelector('[data-testid="path-details"]');
      });
      
      expect(readTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
      
      // Update operation
      await page.click('[data-testid="edit-path-button"]');
      await page.fill('[data-testid="subject-input"]', 'Updated Performance Test');
      
      const updateTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="save-path-button"]');
        await page.waitForSelector('[data-testid="success-message"]');
      });
      
      expect(updateTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
    });

    test('progress analytics API should respond quickly', async ({ page }) => {
      await page.goto('/progress');
      
      const analyticsTime = await perfHelpers.measureApiCall('/api/v1/progress/analytics');
      expect(analyticsTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
      
      // Weekly data should also be fast
      const weeklyTime = await perfHelpers.measureApiCall('/api/v1/progress/analytics/weekly');
      expect(weeklyTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime);
    });

    test('study groups API should handle concurrent requests', async ({ page, context }) => {
      // Open multiple tabs to simulate concurrent users
      const pages = await Promise.all([
        context.newPage(),
        context.newPage(),
        context.newPage()
      ]);
      
      // Navigate all pages to study groups simultaneously
      const navigationPromises = pages.map(p => p.goto('/study-groups'));
      
      const startTime = Date.now();
      await Promise.all(navigationPromises);
      const concurrentTime = Date.now() - startTime;
      
      // Concurrent requests should not significantly slow down response
      expect(concurrentTime).toBeLessThan(PERF_CONFIG.maxApiResponseTime * 1.5);
      
      // Cleanup
      await Promise.all(pages.map(p => p.close()));
    });
  });

  test.describe('User Interaction Performance', () => {
    test('form interactions should be responsive', async ({ page }) => {
      await page.goto('/learning-paths');
      await page.click('[data-testid="create-learning-path-button"]');
      
      // Typing should be responsive
      const typingTime = await perfHelpers.measureInteraction(async () => {
        await page.fill('[data-testid="subject-input"]', 'Responsive Form Test');
      });
      
      expect(typingTime).toBeLessThan(PERF_CONFIG.maxInteractionTime);
      
      // Button clicks should be immediate
      const clickTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="add-goal-button"]');
        await page.waitForSelector('[data-testid="goal-input"]');
      });
      
      expect(clickTime).toBeLessThan(PERF_CONFIG.maxInteractionTime);
    });

    test('navigation should be fast', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Navigation between pages should be quick
      const navTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="nav-learning-paths"]');
        await page.waitForURL('/learning-paths');
      });
      
      expect(navTime).toBeLessThan(PERF_CONFIG.maxInteractionTime);
    });

    test('search and filtering should be performant', async ({ page }) => {
      await page.goto('/learning-paths');
      
      // Mock large dataset for search performance test
      await page.route('**/api/v1/learning-paths', route => {
        const largePaths = Array.from({ length: 100 }, (_, i) => ({
          id: `path-${i}`,
          subject: `Subject ${i}`,
          currentLevel: 'intermediate',
          objectives: [`Objective ${i}`],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: largePaths
          })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="learning-path-item"]');
      
      // Search should be fast even with large dataset
      const searchTime = await perfHelpers.measureInteraction(async () => {
        await page.fill('[data-testid="search-input"]', 'Subject 5');
        await page.waitForFunction(() => {
          const items = document.querySelectorAll('[data-testid="learning-path-item"]:visible');
          return items.length < 20; // Should filter results
        });
      });
      
      expect(searchTime).toBeLessThan(PERF_CONFIG.maxInteractionTime);
    });
  });

  test.describe('Performance Under Stress', () => {
    test('should maintain performance with slow network', async ({ page }) => {
      await perfHelpers.simulateSlowNetwork();
      
      const loadTime = await perfHelpers.measurePageLoad('/learning-paths');
      
      // Should still be usable even with slow network
      expect(loadTime).toBeLessThan(PERF_CONFIG.maxPageLoadTime * 2);
      
      // Should show appropriate loading states
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    });

    test('should handle memory pressure gracefully', async ({ page }) => {
      // Create memory pressure by loading large amounts of data
      await page.route('**/api/v1/learning-paths', route => {
        const massivePaths = Array.from({ length: 1000 }, (_, i) => ({
          id: `path-${i}`,
          subject: `Subject ${i}`.repeat(100), // Large strings
          currentLevel: 'intermediate',
          objectives: Array.from({ length: 50 }, (_, j) => `Objective ${i}-${j}`),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: massivePaths
          })
        });
      });
      
      await page.goto('/learning-paths');
      
      // Should implement virtualization or pagination
      const visibleItems = await page.locator('[data-testid="learning-path-item"]:visible').count();
      expect(visibleItems).toBeLessThanOrEqual(50); // Should not render all 1000 items
      
      // Memory usage should be controlled
      const memoryUsage = await perfHelpers.measureMemoryUsage();
      if (memoryUsage) {
        expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      }
    });

    test('should maintain responsiveness during heavy computation', async ({ page }) => {
      await perfHelpers.simulateSlowCPU();
      
      await page.goto('/progress');
      
      // Should still be interactive during chart rendering
      const interactionTime = await perfHelpers.measureInteraction(async () => {
        await page.click('[data-testid="time-range-selector"]');
        await page.click('[data-testid="monthly-option"]');
      });
      
      expect(interactionTime).toBeLessThan(PERF_CONFIG.maxInteractionTime * 2);
    });
  });

  test.describe('Bundle Size and Loading Performance', () => {
    test('should have reasonable bundle sizes', async ({ page }) => {
      // Monitor network requests to check bundle sizes
      const resourceSizes: Record<string, number> = {};
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('.js') || url.includes('.css')) {
          response.body().then(body => {
            resourceSizes[url] = body.length;
          }).catch(() => {
            // Ignore errors for cross-origin resources
          });
        }
      });
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Main bundle should be under 1MB
      const mainBundle = Object.entries(resourceSizes).find(([url]) => 
        url.includes('main') && url.includes('.js')
      );
      
      if (mainBundle) {
        expect(mainBundle[1]).toBeLessThan(1024 * 1024); // 1MB
      }
      
      // Total JS should be under 2MB
      const totalJS = Object.entries(resourceSizes)
        .filter(([url]) => url.includes('.js'))
        .reduce((sum, [, size]) => sum + size, 0);
      
      expect(totalJS).toBeLessThan(2 * 1024 * 1024); // 2MB
    });

    test('should implement code splitting effectively', async ({ page }) => {
      const loadedChunks: string[] = [];
      
      page.on('response', response => {
        const url = response.url();
        if (url.includes('.js') && response.status() === 200) {
          loadedChunks.push(url);
        }
      });
      
      // Initial page load
      await page.goto('/dashboard');
      const initialChunks = [...loadedChunks];
      
      // Navigate to different page
      await page.click('[data-testid="nav-learning-paths"]');
      await page.waitForURL('/learning-paths');
      
      const newChunks = loadedChunks.filter(chunk => !initialChunks.includes(chunk));
      
      // Should load additional chunks for new page
      expect(newChunks.length).toBeGreaterThan(0);
      
      // But not too many (indicating good code splitting)
      expect(newChunks.length).toBeLessThan(5);
    });
  });

  test.describe('Real User Monitoring Simulation', () => {
    test('should track performance metrics like a real user', async ({ page }) => {
      // Simulate real user behavior patterns
      await page.goto('/dashboard');
      
      // User reads dashboard for a few seconds
      await page.waitForTimeout(2000);
      
      // Navigate to learning paths
      await page.click('[data-testid="nav-learning-paths"]');
      await page.waitForURL('/learning-paths');
      
      // User scrolls through paths
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1000);
      
      // User creates a new path
      await page.click('[data-testid="create-learning-path-button"]');
      await page.fill('[data-testid="subject-input"]', 'Real User Test');
      await page.click('[data-testid="add-goal-button"]');
      await page.fill('[data-testid="goal-input"]', 'Simulate real usage');
      await page.click('[data-testid="create-path-button"]');
      
      // Collect performance metrics throughout the session
      const sessionMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const resources = performance.getEntriesByType('resource');
        
        return {
          pageLoadTime: navigation.loadEventEnd - navigation.navigationStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          resourceCount: resources.length,
          totalResourceSize: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0)
        };
      });
      
      // Validate real-world performance expectations
      expect(sessionMetrics.pageLoadTime).toBeLessThan(5000); // 5 seconds total
      expect(sessionMetrics.domContentLoaded).toBeLessThan(2000); // 2 seconds to interactive
      expect(sessionMetrics.firstContentfulPaint).toBeLessThan(1500); // 1.5 seconds to first content
      expect(sessionMetrics.totalResourceSize).toBeLessThan(5 * 1024 * 1024); // 5MB total resources
      
      console.log('Real user simulation metrics:', sessionMetrics);
    });
  });
});