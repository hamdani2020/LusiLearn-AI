import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage, ContentDiscoveryPage, LearningSessionPage } from './fixtures/page-objects';
import { testUsers, testContent } from './fixtures/test-data';

test.describe('Content Discovery and Consumption Workflows', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let contentDiscoveryPage: ContentDiscoveryPage;
  let learningSessionPage: LearningSessionPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    contentDiscoveryPage = new ContentDiscoveryPage(page);
    learningSessionPage = new LearningSessionPage(page);

    // Login as test user
    await loginPage.goto();
    await loginPage.login(testUsers.highSchoolStudent.email, testUsers.highSchoolStudent.password);
    await loginPage.expectLoginSuccess();
  });

  test('should discover content through search and filters', async ({ page }) => {
    // Navigate to content discovery
    await dashboardPage.exploreContent();
    await expect(page).toHaveURL(/\/content/);

    // Should show content discovery interface
    await expect(contentDiscoveryPage.searchInput).toBeVisible();
    await expect(contentDiscoveryPage.filterSection).toBeVisible();
    await expect(contentDiscoveryPage.contentGrid).toBeVisible();

    // Search for programming content
    await contentDiscoveryPage.searchContent('JavaScript');
    await contentDiscoveryPage.expectContentResults();

    // Apply difficulty filter
    await contentDiscoveryPage.applyFilter('difficulty', 'beginner');
    
    // Should show filtered results
    const contentItems = page.locator('[data-testid=content-item]');
    await expect(contentItems.first()).toBeVisible();
    
    // Verify all results match filter
    for (let i = 0; i < Math.min(await contentItems.count(), 5); i++) {
      const item = contentItems.nth(i);
      await expect(item.locator('[data-testid=difficulty-badge]')).toContainText('Beginner');
    }
  });

  test('should show personalized content recommendations', async ({ page }) => {
    await dashboardPage.exploreContent();

    // Should show personalized recommendations section
    await expect(page.locator('[data-testid=recommended-for-you]')).toBeVisible();
    await expect(page.locator('[data-testid=trending-content]')).toBeVisible();
    await expect(page.locator('[data-testid=continue-learning]')).toBeVisible();

    // Recommendations should be relevant to user profile
    const recommendedItems = page.locator('[data-testid=recommended-item]');
    await expect(recommendedItems.first()).toBeVisible();
    
    // Should show recommendation reasons
    await expect(page.locator('[data-testid=recommendation-reason]').first()).toBeVisible();
  });

  test('should consume video content with tracking', async ({ page }) => {
    await dashboardPage.exploreContent();
    
    // Select a video content item
    await contentDiscoveryPage.selectContent(0);
    await expect(page).toHaveURL(/\/content\/[a-zA-Z0-9-]+/);

    // Should show content player
    await expect(page.locator('[data-testid=video-player]')).toBeVisible();
    await expect(page.locator('[data-testid=content-title]')).toBeVisible();
    await expect(page.locator('[data-testid=content-description]')).toBeVisible();

    // Start playing content
    await page.locator('[data-testid=play-button]').click();
    
    // Should track viewing progress
    await page.waitForTimeout(5000); // Simulate watching
    await expect(page.locator('[data-testid=progress-indicator]')).not.toHaveAttribute('style', 'width: 0%');

    // Should show engagement options
    await expect(page.locator('[data-testid=like-button]')).toBeVisible();
    await expect(page.locator('[data-testid=bookmark-button]')).toBeVisible();
    await expect(page.locator('[data-testid=share-button]')).toBeVisible();

    // Rate the content
    await page.locator('[data-testid=rating-stars]').locator('nth=3').click();
    await expect(page.locator('[data-testid=rating-confirmation]')).toBeVisible();
  });

  test('should handle different content formats appropriately', async ({ page }) => {
    await dashboardPage.exploreContent();

    // Test video content
    await contentDiscoveryPage.applyFilter('format', 'video');
    await contentDiscoveryPage.selectContent(0);
    await expect(page.locator('[data-testid=video-player]')).toBeVisible();
    await page.goBack();

    // Test article content
    await contentDiscoveryPage.applyFilter('format', 'article');
    await contentDiscoveryPage.selectContent(0);
    await expect(page.locator('[data-testid=article-reader]')).toBeVisible();
    await expect(page.locator('[data-testid=reading-progress]')).toBeVisible();
    await page.goBack();

    // Test interactive content
    await contentDiscoveryPage.applyFilter('format', 'interactive');
    await contentDiscoveryPage.selectContent(0);
    await expect(page.locator('[data-testid=interactive-content]')).toBeVisible();
    await expect(page.locator('[data-testid=interaction-controls]')).toBeVisible();
  });

  test('should enforce age-appropriate content filtering', async ({ page, context }) => {
    // Login as K-12 student
    await page.goto('/auth/login');
    await page.locator('[data-testid=email-input]').fill(testUsers.k12Student.email);
    await page.locator('[data-testid=password-input]').fill(testUsers.k12Student.password);
    await page.locator('[data-testid=login-button]').click();

    await dashboardPage.exploreContent();

    // Should only show age-appropriate content
    const contentItems = page.locator('[data-testid=content-item]');
    for (let i = 0; i < Math.min(await contentItems.count(), 5); i++) {
      const item = contentItems.nth(i);
      const ageRating = await item.locator('[data-testid=age-rating]').textContent();
      expect(ageRating).toMatch(/(All Ages|K-12|Elementary|Middle School|High School)/);
    }

    // Should not show adult content
    await contentDiscoveryPage.searchContent('advanced machine learning');
    const adultContent = page.locator('[data-testid=content-item]:has-text("Adult")');
    await expect(adultContent).toHaveCount(0);
  });

  test('should create and manage personal content library', async ({ page }) => {
    await dashboardPage.exploreContent();

    // Bookmark content items
    const contentItems = page.locator('[data-testid=content-item]');
    await contentItems.first().locator('[data-testid=bookmark-button]').click();
    await expect(page.locator('[data-testid=bookmark-success]')).toBeVisible();

    await contentItems.nth(1).locator('[data-testid=bookmark-button]').click();

    // Navigate to personal library
    await page.locator('[data-testid=my-library]').click();
    await expect(page).toHaveURL(/\/library/);

    // Should show bookmarked content
    await expect(page.locator('[data-testid=bookmarked-content]')).toBeVisible();
    await expect(page.locator('[data-testid=library-item]')).toHaveCount(2);

    // Should show different library sections
    await expect(page.locator('[data-testid=bookmarks-tab]')).toBeVisible();
    await expect(page.locator('[data-testid=history-tab]')).toBeVisible();
    await expect(page.locator('[data-testid=downloads-tab]')).toBeVisible();

    // Test history tab
    await page.locator('[data-testid=history-tab]').click();
    await expect(page.locator('[data-testid=recently-viewed]')).toBeVisible();
  });

  test('should provide content quality indicators and user reviews', async ({ page }) => {
    await dashboardPage.exploreContent();
    await contentDiscoveryPage.selectContent(0);

    // Should show quality indicators
    await expect(page.locator('[data-testid=quality-score]')).toBeVisible();
    await expect(page.locator('[data-testid=user-rating]')).toBeVisible();
    await expect(page.locator('[data-testid=completion-rate]')).toBeVisible();
    await expect(page.locator('[data-testid=effectiveness-score]')).toBeVisible();

    // Should show user reviews
    await page.locator('[data-testid=reviews-tab]').click();
    await expect(page.locator('[data-testid=user-reviews]')).toBeVisible();
    await expect(page.locator('[data-testid=review-item]').first()).toBeVisible();

    // Should allow adding review
    await page.locator('[data-testid=add-review]').click();
    await page.locator('[data-testid=review-rating]').locator('nth=3').click();
    await page.locator('[data-testid=review-text]').fill('Great content for beginners!');
    await page.locator('[data-testid=submit-review]').click();

    await expect(page.locator('[data-testid=review-success]')).toBeVisible();
  });

  test('should handle content from multiple external sources', async ({ page }) => {
    await dashboardPage.exploreContent();

    // Should show content from different sources
    await expect(page.locator('[data-testid=source-youtube]')).toBeVisible();
    await expect(page.locator('[data-testid=source-khan-academy]')).toBeVisible();
    await expect(page.locator('[data-testid=source-coursera]')).toBeVisible();

    // Filter by source
    await contentDiscoveryPage.applyFilter('source', 'youtube');
    const youtubeItems = page.locator('[data-testid=content-item]');
    
    for (let i = 0; i < Math.min(await youtubeItems.count(), 3); i++) {
      const item = youtubeItems.nth(i);
      await expect(item.locator('[data-testid=source-badge]')).toContainText('YouTube');
    }

    // Test external link handling
    await contentDiscoveryPage.selectContent(0);
    await expect(page.locator('[data-testid=external-link-notice]')).toBeVisible();
    await page.locator('[data-testid=continue-to-source]').click();
    
    // Should track external navigation
    await expect(page.locator('[data-testid=external-tracking]')).toBeVisible();
  });

  test('should provide offline content access', async ({ page, context }) => {
    await dashboardPage.exploreContent();
    await contentDiscoveryPage.selectContent(0);

    // Download content for offline access
    await page.locator('[data-testid=download-button]').click();
    await expect(page.locator('[data-testid=download-progress]')).toBeVisible();
    await expect(page.locator('[data-testid=download-complete]')).toBeVisible();

    // Go offline
    await context.setOffline(true);

    // Navigate to library
    await page.goto('/library');
    await page.locator('[data-testid=downloads-tab]').click();

    // Should show downloaded content
    await expect(page.locator('[data-testid=offline-content]')).toBeVisible();
    
    // Should be able to access offline content
    await page.locator('[data-testid=offline-content]').first().click();
    await expect(page.locator('[data-testid=offline-player]')).toBeVisible();
    await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible();
  });

  test('should integrate content consumption with learning paths', async ({ page }) => {
    await dashboardPage.exploreContent();
    await contentDiscoveryPage.selectContent(0);

    // Should show learning path integration
    await expect(page.locator('[data-testid=add-to-path]')).toBeVisible();
    
    // Add to current learning path
    await page.locator('[data-testid=add-to-path]').click();
    await page.locator('[data-testid=current-path]').click();
    await expect(page.locator('[data-testid=added-to-path]')).toBeVisible();

    // Navigate back to dashboard
    await page.goto('/dashboard');
    
    // Should show updated learning path
    await expect(page.locator('[data-testid=path-updated]')).toBeVisible();
    await page.locator('[data-testid=view-path]').click();
    
    // Should see the added content in path
    await expect(page.locator('[data-testid=path-content]')).toContainText('JavaScript');
  });

  test('should handle content moderation and reporting', async ({ page }) => {
    await dashboardPage.exploreContent();
    await contentDiscoveryPage.selectContent(0);

    // Should show report option
    await page.locator('[data-testid=content-menu]').click();
    await expect(page.locator('[data-testid=report-content]')).toBeVisible();

    // Report inappropriate content
    await page.locator('[data-testid=report-content]').click();
    await page.locator('[data-testid=report-reason]').selectOption('inappropriate');
    await page.locator('[data-testid=report-details]').fill('Test report for inappropriate content');
    await page.locator('[data-testid=submit-report]').click();

    await expect(page.locator('[data-testid=report-submitted]')).toBeVisible();
    await expect(page.locator('[data-testid=report-id]')).toBeVisible();

    // Should show content under review
    await expect(page.locator('[data-testid=under-review]')).toBeVisible();
  });

  test('should provide accessibility features for content consumption', async ({ page }) => {
    await dashboardPage.exploreContent();
    await contentDiscoveryPage.selectContent(0);

    // Should show accessibility options
    await page.locator('[data-testid=accessibility-menu]').click();
    await expect(page.locator('[data-testid=captions-toggle]')).toBeVisible();
    await expect(page.locator('[data-testid=playback-speed]')).toBeVisible();
    await expect(page.locator('[data-testid=font-size-control]')).toBeVisible();
    await expect(page.locator('[data-testid=high-contrast-toggle]')).toBeVisible();

    // Enable captions
    await page.locator('[data-testid=captions-toggle]').click();
    await expect(page.locator('[data-testid=captions-enabled]')).toBeVisible();

    // Adjust playback speed
    await page.locator('[data-testid=playback-speed]').selectOption('0.75');
    await expect(page.locator('[data-testid=speed-indicator]')).toContainText('0.75x');

    // Increase font size
    await page.locator('[data-testid=font-size-increase]').click();
    await expect(page.locator('[data-testid=content-text]')).toHaveCSS('font-size', /larger|18px|1.2em/);
  });

  test('should track and analyze content consumption patterns', async ({ page }) => {
    // Consume multiple pieces of content
    await dashboardPage.exploreContent();
    
    for (let i = 0; i < 3; i++) {
      await contentDiscoveryPage.selectContent(i);
      await page.locator('[data-testid=play-button]').click();
      await page.waitForTimeout(3000); // Simulate watching
      await page.goBack();
    }

    // Navigate to analytics
    await page.goto('/dashboard');
    await page.locator('[data-testid=analytics-tab]').click();

    // Should show content consumption analytics
    await expect(page.locator('[data-testid=content-analytics]')).toBeVisible();
    await expect(page.locator('[data-testid=time-spent-content]')).toBeVisible();
    await expect(page.locator('[data-testid=content-preferences]')).toBeVisible();
    await expect(page.locator('[data-testid=completion-rates]')).toBeVisible();

    // Should show personalized insights
    await expect(page.locator('[data-testid=learning-insights]')).toBeVisible();
    await expect(page.locator('[data-testid=content-recommendations-based-on-history]')).toBeVisible();
  });
});