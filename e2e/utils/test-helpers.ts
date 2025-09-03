import { Page, expect } from '@playwright/test';

/**
 * Utility functions for E2E tests
 */

export class TestHelpers {
  /**
   * Wait for API response and verify status
   */
  static async waitForApiResponse(page: Page, url: string, expectedStatus: number = 200) {
    const response = await page.waitForResponse(response => 
      response.url().includes(url) && response.status() === expectedStatus
    );
    return response;
  }

  /**
   * Clear all application data (cookies, localStorage, sessionStorage)
   */
  static async clearApplicationData(page: Page) {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Mock API responses for testing
   */
  static async mockApiResponse(page: Page, url: string, response: any) {
    await page.route(`**/${url}`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Wait for element to be visible with timeout
   */
  static async waitForElement(page: Page, selector: string, timeout: number = 10000) {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Simulate typing with realistic delays
   */
  static async typeWithDelay(page: Page, selector: string, text: string, delay: number = 100) {
    const element = page.locator(selector);
    await element.click();
    await element.fill('');
    
    for (const char of text) {
      await element.type(char, { delay });
    }
  }

  /**
   * Take screenshot with timestamp
   */
  static async takeTimestampedScreenshot(page: Page, name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Verify accessibility standards
   */
  static async checkAccessibility(page: Page) {
    // Check for basic accessibility requirements
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);

    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }

    // Check for form labels
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"], textarea');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = await label.count() > 0;
        expect(labelExists || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  }

  /**
   * Simulate network conditions
   */
  static async simulateSlowNetwork(page: Page) {
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 1000); // 1 second delay
    });
  }

  /**
   * Generate random test data
   */
  static generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `test-${timestamp}-${random}@example.com`;
  }

  static generateRandomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, length + 2);
  }

  /**
   * Wait for loading states to complete
   */
  static async waitForLoadingComplete(page: Page) {
    // Wait for common loading indicators to disappear
    await page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('[data-testid*="loading"], .loading, .spinner');
      return loadingElements.length === 0;
    }, { timeout: 30000 });
  }

  /**
   * Verify responsive design
   */
  static async testResponsiveDesign(page: Page) {
    const viewports = [
      { width: 320, height: 568 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1920, height: 1080 } // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000); // Allow layout to adjust
      
      // Verify no horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      expect(hasHorizontalScroll).toBeFalsy();
    }
  }

  /**
   * Verify performance metrics
   */
  static async checkPerformanceMetrics(page: Page) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    // Assert reasonable performance thresholds
    expect(metrics.loadTime).toBeLessThan(5000); // 5 seconds
    expect(metrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds
  }

  /**
   * Handle authentication state
   */
  static async saveAuthState(page: Page, filePath: string) {
    await page.context().storageState({ path: filePath });
  }

  static async loadAuthState(page: Page, filePath: string) {
    // This would be used in test setup to load saved auth state
    // Implementation depends on how auth state is stored
  }

  /**
   * Database cleanup utilities
   */
  static async cleanupTestData(page: Page, userId?: string) {
    if (userId) {
      // Make API call to cleanup test data
      await page.request.delete(`/api/test/cleanup/${userId}`);
    }
  }

  /**
   * Verify error handling
   */
  static async triggerAndVerifyError(page: Page, triggerAction: () => Promise<void>, expectedErrorMessage: string) {
    await triggerAction();
    
    const errorElement = page.locator('[data-testid*="error"], .error-message, [role="alert"]');
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText(expectedErrorMessage);
  }

  /**
   * Simulate user interactions with realistic timing
   */
  static async simulateHumanInteraction(page: Page, actions: Array<{ type: string, selector?: string, text?: string, delay?: number }>) {
    for (const action of actions) {
      await page.waitForTimeout(action.delay || 500);
      
      switch (action.type) {
        case 'click':
          if (action.selector) {
            await page.locator(action.selector).click();
          }
          break;
        case 'type':
          if (action.selector && action.text) {
            await this.typeWithDelay(page, action.selector, action.text);
          }
          break;
        case 'scroll':
          await page.evaluate(() => window.scrollBy(0, 300));
          break;
        case 'hover':
          if (action.selector) {
            await page.locator(action.selector).hover();
          }
          break;
      }
    }
  }
}