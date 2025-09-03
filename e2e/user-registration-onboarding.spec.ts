import { test, expect } from '@playwright/test';
import { LoginPage, RegisterPage, OnboardingPage, DashboardPage } from './fixtures/page-objects';
import { testUsers } from './fixtures/test-data';

test.describe('User Registration and Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start with a clean state
    await page.context().clearCookies();
  });

  test('should complete full registration and onboarding for K-12 student', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.k12Student;

    // Navigate to registration page
    await registerPage.goto();
    await expect(page).toHaveTitle(/Register/);

    // Fill registration form
    await registerPage.register(userData);

    // Should redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(onboardingPage.welcomeMessage).toContainText('Welcome');

    // Complete onboarding steps
    await onboardingPage.selectLearningGoals(userData.learningGoals);
    await onboardingPage.nextButton.click();

    // Complete onboarding
    await onboardingPage.completeOnboarding();

    // Should redirect to dashboard
    await expect(dashboardPage.welcomeMessage).toContainText(userData.firstName);
    await expect(dashboardPage.learningPathsSection).toBeVisible();
    await expect(dashboardPage.progressSection).toBeVisible();
  });

  test('should complete registration for high school student with programming focus', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.highSchoolStudent;

    await registerPage.goto();
    await registerPage.register(userData);

    // Verify onboarding shows age-appropriate content
    await expect(page).toHaveURL(/\/onboarding/);
    await onboardingPage.selectLearningGoals(userData.learningGoals);
    await onboardingPage.completeOnboarding();

    // Verify dashboard shows programming-focused content
    await expect(dashboardPage.learningPathsSection).toContainText('programming');
    await expect(page.locator('[data-testid=recommended-content]')).toContainText('JavaScript');
  });

  test('should complete registration for college student', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.collegeStudent;

    await registerPage.goto();
    await registerPage.register(userData);

    await expect(page).toHaveURL(/\/onboarding/);
    await onboardingPage.selectLearningGoals(userData.learningGoals);
    await onboardingPage.completeOnboarding();

    // Verify college-level features are available
    await expect(dashboardPage.findPeersButton).toBeVisible();
    await expect(page.locator('[data-testid=advanced-features]')).toBeVisible();
  });

  test('should complete registration for professional learner', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.professional;

    await registerPage.goto();
    await registerPage.register(userData);

    await expect(page).toHaveURL(/\/onboarding/);
    await onboardingPage.selectLearningGoals(userData.learningGoals);
    await onboardingPage.completeOnboarding();

    // Verify professional features are available
    await expect(page.locator('[data-testid=professional-courses]')).toBeVisible();
    await expect(page.locator('[data-testid=certification-tracks]')).toBeVisible();
  });

  test('should handle registration validation errors', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();

    // Try to register with invalid data
    await registerPage.emailInput.fill('invalid-email');
    await registerPage.passwordInput.fill('weak');
    await registerPage.registerButton.click();

    // Should show validation errors
    await expect(page.locator('[data-testid=email-error]')).toContainText('valid email');
    await expect(page.locator('[data-testid=password-error]')).toContainText('password');
  });

  test('should handle duplicate email registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const userData = testUsers.k12Student;

    await registerPage.goto();

    // First registration
    await registerPage.register(userData);
    await expect(page).toHaveURL(/\/onboarding/);

    // Navigate back to registration
    await registerPage.goto();

    // Try to register with same email
    await registerPage.register(userData);

    // Should show error message
    await expect(page.locator('[data-testid=registration-error]')).toContainText('already exists');
  });

  test('should allow login after successful registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const loginPage = new LoginPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.collegeStudent;

    // Complete registration and onboarding
    await registerPage.goto();
    await registerPage.register(userData);
    await onboardingPage.selectLearningGoals(userData.learningGoals);
    await onboardingPage.completeOnboarding();

    // Logout
    await page.locator('[data-testid=user-menu]').click();
    await page.locator('[data-testid=logout]').click();

    // Login with registered credentials
    await loginPage.goto();
    await loginPage.login(userData.email, userData.password);

    // Should redirect to dashboard
    await loginPage.expectLoginSuccess();
    await expect(dashboardPage.welcomeMessage).toContainText(userData.firstName);
  });

  test('should enforce parental controls for minors', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const userData = { ...testUsers.k12Student, ageRange: '8-10' };

    await registerPage.goto();
    await registerPage.register(userData);

    // Should show parental consent requirement
    await expect(page.locator('[data-testid=parental-consent]')).toBeVisible();
    await expect(page.locator('[data-testid=parent-email-input]')).toBeVisible();

    // Complete parental consent
    await page.locator('[data-testid=parent-email-input]').fill('parent@test.com');
    await page.locator('[data-testid=consent-checkbox]').check();
    await page.locator('[data-testid=submit-consent]').click();

    // Should proceed to onboarding with restricted features
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.locator('[data-testid=safety-notice]')).toBeVisible();
  });

  test('should skip onboarding if user chooses to', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);
    const userData = testUsers.professional;

    await registerPage.goto();
    await registerPage.register(userData);

    await expect(page).toHaveURL(/\/onboarding/);
    await onboardingPage.skipButton.click();

    // Should redirect to dashboard with default settings
    await expect(page).toHaveURL('/dashboard');
    await expect(dashboardPage.welcomeMessage).toContainText(userData.firstName);
    await expect(page.locator('[data-testid=setup-reminder]')).toBeVisible();
  });
});