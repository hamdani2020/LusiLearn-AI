import { test, expect } from '@playwright/test';
import { 
  LoginPage, 
  RegisterPage, 
  OnboardingPage, 
  DashboardPage, 
  LearningSessionPage,
  ContentDiscoveryPage,
  CollaborationPage 
} from './fixtures/page-objects';
import { testUsers, testStudyGroups } from './fixtures/test-data';
import { TestHelpers } from './utils/test-helpers';

test.describe('Complete User Journey - End-to-End', () => {
  test('should complete full user journey from registration to collaboration', async ({ page, context }) => {
    // Generate unique test data
    const uniqueUser = {
      ...testUsers.highSchoolStudent,
      email: TestHelpers.generateRandomEmail(),
      firstName: 'TestUser' + TestHelpers.generateRandomString(5)
    };

    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const learningSessionPage = new LearningSessionPage(page);
    const contentDiscoveryPage = new ContentDiscoveryPage(page);
    const collaborationPage = new CollaborationPage(page);

    // Step 1: User Registration
    await test.step('Complete user registration', async () => {
      await registerPage.goto();
      await registerPage.register(uniqueUser);
      await expect(page).toHaveURL(/\/onboarding/);
    });

    // Step 2: Onboarding Process
    await test.step('Complete onboarding process', async () => {
      await expect(onboardingPage.welcomeMessage).toContainText('Welcome');
      await onboardingPage.selectLearningGoals(uniqueUser.learningGoals);
      await onboardingPage.completeOnboarding();
      await expect(page).toHaveURL('/dashboard');
    });

    // Step 3: Dashboard Exploration
    await test.step('Explore dashboard features', async () => {
      await expect(dashboardPage.welcomeMessage).toContainText(uniqueUser.firstName);
      await expect(dashboardPage.learningPathsSection).toBeVisible();
      await expect(dashboardPage.progressSection).toBeVisible();
      
      // Take screenshot of dashboard
      await TestHelpers.takeTimestampedScreenshot(page, 'dashboard-initial');
    });

    // Step 4: Learning Session Completion
    await test.step('Complete learning session with progress tracking', async () => {
      await dashboardPage.startLearningSession();
      await expect(page).toHaveURL(/\/learn/);
      
      // Complete content and assessment
      await learningSessionPage.completeContent();
      await learningSessionPage.takeAssessment([1, 1]); // Correct answers
      
      // Verify progress tracking
      await learningSessionPage.expectProgressUpdate();
      await expect(page.locator('[data-testid=score-display]')).toContainText('100%');
      
      // Return to dashboard
      await page.goto('/dashboard');
      const progress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
      expect(parseInt(progress || '0')).toBeGreaterThan(0);
    });

    // Step 5: Content Discovery and Consumption
    await test.step('Discover and consume content', async () => {
      await dashboardPage.exploreContent();
      await expect(page).toHaveURL(/\/content/);
      
      // Search for content
      await contentDiscoveryPage.searchContent('JavaScript');
      await contentDiscoveryPage.expectContentResults();
      
      // Apply filters
      await contentDiscoveryPage.applyFilter('difficulty', 'beginner');
      
      // Select and consume content
      await contentDiscoveryPage.selectContent(0);
      await expect(page.locator('[data-testid=content-player]')).toBeVisible();
      
      // Bookmark content
      await page.locator('[data-testid=bookmark-button]').click();
      await expect(page.locator('[data-testid=bookmark-success]')).toBeVisible();
    });

    // Step 6: Peer Collaboration
    await test.step('Engage in peer collaboration', async () => {
      await page.goto('/collaboration');
      
      // Create study group
      const uniqueGroupName = 'Test Group ' + TestHelpers.generateRandomString(5);
      const groupData = { ...testStudyGroups.codingBootcamp, name: uniqueGroupName };
      
      await collaborationPage.createStudyGroup(groupData);
      await expect(page.locator('[data-testid=group-name]')).toContainText(uniqueGroupName);
      
      // Start collaboration session
      await page.locator('[data-testid=start-session]').click();
      await expect(page.locator('[data-testid=collaboration-session]')).toBeVisible();
      
      // Send message in chat
      await collaborationPage.sendMessage('Hello from E2E test!');
      await collaborationPage.expectMessageSent('Hello from E2E test!');
    });

    // Step 7: Analytics and Progress Review
    await test.step('Review analytics and progress', async () => {
      await page.goto('/dashboard');
      await page.locator('[data-testid=analytics-tab]').click();
      
      // Verify comprehensive analytics
      await expect(page.locator('[data-testid=completion-rate]')).toBeVisible();
      await expect(page.locator('[data-testid=time-spent-content]')).toBeVisible();
      await expect(page.locator('[data-testid=learning-insights]')).toBeVisible();
      
      // Check learning streak
      await expect(page.locator('[data-testid=learning-streak]')).toBeVisible();
    });

    // Step 8: Profile Management
    await test.step('Update user profile and preferences', async () => {
      await page.locator('[data-testid=user-menu]').click();
      await page.locator('[data-testid=profile-settings]').click();
      
      // Update learning preferences
      await page.locator('[data-testid=learning-style-visual]').check();
      await page.locator('[data-testid=session-duration]').selectOption('30');
      await page.locator('[data-testid=save-preferences]').click();
      
      await expect(page.locator('[data-testid=preferences-saved]')).toBeVisible();
    });

    // Step 9: Accessibility and Responsive Design
    await test.step('Verify accessibility and responsive design', async () => {
      // Test accessibility
      await TestHelpers.checkAccessibility(page);
      
      // Test responsive design
      await TestHelpers.testResponsiveDesign(page);
    });

    // Step 10: Performance Verification
    await test.step('Verify performance metrics', async () => {
      await page.goto('/dashboard');
      await TestHelpers.checkPerformanceMetrics(page);
    });

    // Step 11: Logout and Re-login
    await test.step('Test logout and re-login functionality', async () => {
      // Logout
      await page.locator('[data-testid=user-menu]').click();
      await page.locator('[data-testid=logout]').click();
      await expect(page).toHaveURL(/\/auth\/login/);
      
      // Re-login
      const loginPage = new LoginPage(page);
      await loginPage.login(uniqueUser.email, uniqueUser.password);
      await loginPage.expectLoginSuccess();
      
      // Verify data persistence
      await expect(dashboardPage.welcomeMessage).toContainText(uniqueUser.firstName);
      const persistedProgress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
      expect(parseInt(persistedProgress || '0')).toBeGreaterThan(0);
    });

    // Cleanup test data
    await TestHelpers.cleanupTestData(page, uniqueUser.email);
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const loginPage = new LoginPage(page);

    // Test registration with invalid data
    await test.step('Handle registration validation errors', async () => {
      await registerPage.goto();
      
      await TestHelpers.triggerAndVerifyError(page, async () => {
        await registerPage.emailInput.fill('invalid-email');
        await registerPage.passwordInput.fill('weak');
        await registerPage.registerButton.click();
      }, 'valid email');
    });

    // Test login with invalid credentials
    await test.step('Handle login authentication errors', async () => {
      await loginPage.goto();
      
      await TestHelpers.triggerAndVerifyError(page, async () => {
        await loginPage.login('nonexistent@test.com', 'wrongpassword');
      }, 'Invalid credentials');
    });

    // Test network error handling
    await test.step('Handle network connectivity issues', async () => {
      await TestHelpers.simulateSlowNetwork(page);
      await loginPage.goto();
      
      // Should show loading states
      await expect(page.locator('[data-testid*="loading"]')).toBeVisible();
      
      // Should eventually load
      await TestHelpers.waitForLoadingComplete(page);
      await expect(loginPage.emailInput).toBeVisible();
    });
  });

  test('should support multiple user types and education levels', async ({ page }) => {
    const testCases = [
      { user: testUsers.k12Student, expectedFeatures: ['parental-controls', 'age-appropriate-content'] },
      { user: testUsers.collegeStudent, expectedFeatures: ['advanced-features', 'peer-matching'] },
      { user: testUsers.professional, expectedFeatures: ['professional-courses', 'certification-tracks'] }
    ];

    for (const testCase of testCases) {
      await test.step(`Test ${testCase.user.educationLevel} user experience`, async () => {
        const registerPage = new RegisterPage(page);
        const onboardingPage = new OnboardingPage(page);
        const dashboardPage = new DashboardPage(page);
        
        const uniqueUser = {
          ...testCase.user,
          email: TestHelpers.generateRandomEmail()
        };

        // Register and complete onboarding
        await registerPage.goto();
        await registerPage.register(uniqueUser);
        await onboardingPage.selectLearningGoals(uniqueUser.learningGoals);
        await onboardingPage.completeOnboarding();

        // Verify education-level specific features
        for (const feature of testCase.expectedFeatures) {
          await expect(page.locator(`[data-testid="${feature}"]`)).toBeVisible();
        }

        // Logout for next test
        await page.locator('[data-testid=user-menu]').click();
        await page.locator('[data-testid=logout]').click();
        
        // Cleanup
        await TestHelpers.cleanupTestData(page, uniqueUser.email);
      });
    }
  });

  test('should maintain data consistency across browser sessions', async ({ page, context }) => {
    const uniqueUser = {
      ...testUsers.collegeStudent,
      email: TestHelpers.generateRandomEmail()
    };

    // Complete registration and some activities
    await test.step('Complete initial user activities', async () => {
      const registerPage = new RegisterPage(page);
      const onboardingPage = new OnboardingPage(page);
      const dashboardPage = new DashboardPage(page);
      const learningSessionPage = new LearningSessionPage(page);

      await registerPage.goto();
      await registerPage.register(uniqueUser);
      await onboardingPage.selectLearningGoals(uniqueUser.learningGoals);
      await onboardingPage.completeOnboarding();

      // Complete learning session
      await dashboardPage.startLearningSession();
      await learningSessionPage.completeContent();
      await learningSessionPage.takeAssessment([1, 1]);
      
      // Save progress data
      const progress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
      await page.evaluate(progress => window.testProgress = progress, progress);
    });

    // Clear session and login again
    await test.step('Verify data persistence after session clear', async () => {
      await TestHelpers.clearApplicationData(page);
      
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(uniqueUser.email, uniqueUser.password);
      await loginPage.expectLoginSuccess();

      // Verify progress is maintained
      const restoredProgress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
      const originalProgress = await page.evaluate(() => window.testProgress);
      
      expect(restoredProgress).toBe(originalProgress);
    });

    // Test with new browser context
    await test.step('Verify data consistency in new browser context', async () => {
      const newContext = await page.context().browser()?.newContext();
      const newPage = await newContext?.newPage();
      
      if (newPage) {
        const loginPage = new LoginPage(newPage);
        await loginPage.goto();
        await loginPage.login(uniqueUser.email, uniqueUser.password);
        await loginPage.expectLoginSuccess();

        // Verify same progress in new context
        const contextProgress = await newPage.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
        const originalProgress = await page.evaluate(() => window.testProgress);
        
        expect(contextProgress).toBe(originalProgress);
        
        await newContext?.close();
      }
    });

    // Cleanup
    await TestHelpers.cleanupTestData(page, uniqueUser.email);
  });
});