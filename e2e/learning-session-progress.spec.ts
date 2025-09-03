import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage, LearningSessionPage } from './fixtures/page-objects';
import { testUsers, testAssessments } from './fixtures/test-data';

test.describe('Learning Session and Progress Tracking', () => {
    let loginPage: LoginPage;
    let dashboardPage: DashboardPage;
    let learningSessionPage: LearningSessionPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        dashboardPage = new DashboardPage(page);
        learningSessionPage = new LearningSessionPage(page);

        // Login as a test user
        await loginPage.goto();
        await loginPage.login(testUsers.highSchoolStudent.email, testUsers.highSchoolStudent.password);
        await loginPage.expectLoginSuccess();
    });

    test('should complete a full learning session with progress tracking', async ({ page }) => {
        // Start learning session from dashboard
        await dashboardPage.startLearningSession();
        await expect(page).toHaveURL(/\/learn/);

        // Verify learning session interface
        await expect(learningSessionPage.contentPlayer).toBeVisible();
        await expect(learningSessionPage.progressBar).toBeVisible();

        // Initial progress should be 0
        const initialProgress = await learningSessionPage.progressBar.getAttribute('aria-valuenow');
        expect(initialProgress).toBe('0');

        // Complete first content item
        await learningSessionPage.completeContent();

        // Progress should update
        await learningSessionPage.expectProgressUpdate();

        // Take assessment
        await expect(learningSessionPage.assessmentSection).toBeVisible();
        await learningSessionPage.takeAssessment([1, 1]); // Correct answers

        // Should show assessment results
        await expect(page.locator('[data-testid=assessment-results]')).toBeVisible();
        await expect(page.locator('[data-testid=score-display]')).toContainText('100%');

        // Continue to next content
        await learningSessionPage.nextContentButton.click();

        // Complete second content item
        await learningSessionPage.completeContent();

        // Final progress should be higher
        const finalProgress = await learningSessionPage.progressBar.getAttribute('aria-valuenow');
        expect(parseInt(finalProgress || '0')).toBeGreaterThan(parseInt(initialProgress || '0'));

        // Return to dashboard and verify progress is saved
        await page.goto('/dashboard');
        const dashboardProgress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
        expect(parseInt(dashboardProgress || '0')).toBeGreaterThan(0);
    });

    test('should track time spent and engagement metrics', async ({ page }) => {
        await dashboardPage.startLearningSession();

        // Simulate content engagement
        await learningSessionPage.contentPlayer.click();

        // Wait to simulate time spent
        await page.waitForTimeout(5000);

        await learningSessionPage.completeContent();

        // Check that time tracking is working
        await expect(page.locator('[data-testid=session-time]')).toContainText('0:05');

        // Complete session and return to dashboard
        await page.goto('/dashboard');

        // Verify analytics show time spent
        await page.locator('[data-testid=analytics-tab]').click();
        await expect(page.locator('[data-testid=total-time-spent]')).toContainText('5');
    });

    test('should handle poor performance with adaptive difficulty', async ({ page }) => {
        await dashboardPage.startLearningSession();

        // Take assessment with poor performance
        await expect(learningSessionPage.assessmentSection).toBeVisible();
        await learningSessionPage.takeAssessment([0, 0]); // Wrong answers

        // Should show low score
        await expect(page.locator('[data-testid=score-display]')).toContainText('0%');

        // Should trigger difficulty adjustment
        await expect(page.locator('[data-testid=difficulty-adjustment]')).toBeVisible();
        await expect(page.locator('[data-testid=remedial-content]')).toBeVisible();

        // Should provide additional foundational content
        await expect(page.locator('[data-testid=prerequisite-content]')).toBeVisible();
    });

    test('should handle excellent performance with advancement', async ({ page }) => {
        await dashboardPage.startLearningSession();

        // Complete content quickly and accurately
        await learningSessionPage.completeContent();
        await learningSessionPage.takeAssessment([1, 1]); // Perfect score

        await expect(page.locator('[data-testid=score-display]')).toContainText('100%');

        // Should offer advanced content
        await expect(page.locator('[data-testid=advancement-offer]')).toBeVisible();

        // Accept advancement
        await page.locator('[data-testid=accept-advancement]').click();

        // Should show more challenging content
        await expect(page.locator('[data-testid=difficulty-level]')).toContainText('Intermediate');
    });

    test('should save progress when session is interrupted', async ({ page }) => {
        await dashboardPage.startLearningSession();

        // Start content but don't complete
        await learningSessionPage.contentPlayer.click();
        await page.waitForTimeout(3000);

        // Navigate away without completing
        await page.goto('/dashboard');

        // Should show resume option
        await expect(page.locator('[data-testid=resume-session]')).toBeVisible();

        // Resume session
        await page.locator('[data-testid=resume-session]').click();

        // Should return to same content with progress preserved
        await expect(page).toHaveURL(/\/learn/);
        await expect(page.locator('[data-testid=resume-indicator]')).toBeVisible();
    });

    test('should track learning streaks and milestones', async ({ page }) => {
        // Complete multiple sessions to build streak
        for (let i = 0; i < 3; i++) {
            await dashboardPage.startLearningSession();
            await learningSessionPage.completeContent();
            await learningSessionPage.takeAssessment([1, 1]);
            await page.goto('/dashboard');
        }

        // Should show learning streak
        await expect(page.locator('[data-testid=learning-streak]')).toContainText('3');

        // Should show milestone achievement
        await expect(page.locator('[data-testid=milestone-notification]')).toBeVisible();
        await expect(page.locator('[data-testid=badge-earned]')).toBeVisible();
    });

    test('should provide detailed analytics and insights', async ({ page }) => {
        // Complete a learning session
        await dashboardPage.startLearningSession();
        await learningSessionPage.completeContent();
        await learningSessionPage.takeAssessment([1, 0]); // Mixed performance
        await page.goto('/dashboard');

        // Navigate to analytics
        await page.locator('[data-testid=analytics-tab]').click();

        // Should show comprehensive analytics
        await expect(page.locator('[data-testid=completion-rate]')).toBeVisible();
        await expect(page.locator('[data-testid=comprehension-score]')).toBeVisible();
        await expect(page.locator('[data-testid=learning-velocity]')).toBeVisible();
        await expect(page.locator('[data-testid=strength-areas]')).toBeVisible();
        await expect(page.locator('[data-testid=improvement-areas]')).toBeVisible();

        // Should provide actionable insights
        await expect(page.locator('[data-testid=recommendations]')).toBeVisible();
        await expect(page.locator('[data-testid=next-steps]')).toBeVisible();
    });

    test('should handle multiple subjects and learning paths', async ({ page }) => {
        // Switch to mathematics learning path
        await page.locator('[data-testid=subject-selector]').click();
        await page.locator('[data-value="mathematics"]').click();

        await dashboardPage.startLearningSession();
        await learningSessionPage.completeContent();
        await page.goto('/dashboard');

        // Switch to programming learning path
        await page.locator('[data-testid=subject-selector]').click();
        await page.locator('[data-value="programming"]').click();

        await dashboardPage.startLearningSession();
        await learningSessionPage.completeContent();
        await page.goto('/dashboard');

        // Should track progress separately for each subject
        await page.locator('[data-testid=analytics-tab]').click();
        await expect(page.locator('[data-testid=subject-breakdown]')).toBeVisible();
        await expect(page.locator('[data-testid=math-progress]')).toBeVisible();
        await expect(page.locator('[data-testid=programming-progress]')).toBeVisible();
    });

    test('should sync progress across devices', async ({ page, context }) => {
        // Complete session on first "device"
        await dashboardPage.startLearningSession();
        await learningSessionPage.completeContent();
        await page.goto('/dashboard');

        const initialProgress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');

        // Simulate second device by opening new page
        const secondPage = await context.newPage();
        const secondLoginPage = new LoginPage(secondPage);
        const secondDashboardPage = new DashboardPage(secondPage);

        await secondLoginPage.goto();
        await secondLoginPage.login(testUsers.highSchoolStudent.email, testUsers.highSchoolStudent.password);
        await secondLoginPage.expectLoginSuccess();

        // Progress should be synced
        const syncedProgress = await secondPage.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
        expect(syncedProgress).toBe(initialProgress);
    });

    test('should handle offline learning session completion', async ({ page, context }) => {
        await dashboardPage.startLearningSession();

        // Simulate going offline
        await context.setOffline(true);

        // Complete content offline
        await learningSessionPage.completeContent();
        await learningSessionPage.takeAssessment([1, 1]);

        // Should show offline indicator
        await expect(page.locator('[data-testid=offline-indicator]')).toBeVisible();

        // Go back online
        await context.setOffline(false);

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Progress should sync when back online
        await expect(page.locator('[data-testid=sync-indicator]')).toBeVisible();
        await page.waitForTimeout(2000); // Wait for sync

        const progress = await page.locator('[data-testid=overall-progress]').getAttribute('aria-valuenow');
        expect(parseInt(progress || '0')).toBeGreaterThan(0);
    });
});