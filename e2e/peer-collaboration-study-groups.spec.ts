import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage, CollaborationPage } from './fixtures/page-objects';
import { testUsers, testStudyGroups } from './fixtures/test-data';

test.describe('Peer Collaboration and Study Groups', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let collaborationPage: CollaborationPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    collaborationPage = new CollaborationPage(page);

    // Login as test user
    await loginPage.goto();
    await loginPage.login(testUsers.highSchoolStudent.email, testUsers.highSchoolStudent.password);
    await loginPage.expectLoginSuccess();
  });

  test('should find and connect with compatible peers', async ({ page }) => {
    // Navigate to peer matching
    await dashboardPage.findPeers();
    await expect(page).toHaveURL(/\/collaboration/);

    // Should show peer matching interface
    await expect(collaborationPage.peerMatchingSection).toBeVisible();

    // Should show recommended peers
    await expect(page.locator('[data-testid=peer-recommendations]')).toBeVisible();
    await expect(page.locator('[data-testid=peer-card]').first()).toBeVisible();

    // View peer profile
    await page.locator('[data-testid=peer-card]').first().click();
    await expect(page.locator('[data-testid=peer-profile]')).toBeVisible();
    await expect(page.locator('[data-testid=compatibility-score]')).toBeVisible();

    // Send connection request
    await page.locator('[data-testid=connect-button]').click();
    await expect(page.locator('[data-testid=connection-sent]')).toBeVisible();
  });

  test('should create and manage study groups', async ({ page }) => {
    await dashboardPage.findPeers();

    // Create new study group
    await collaborationPage.createStudyGroup(testStudyGroups.mathStudyGroup);

    // Should redirect to group page
    await expect(page).toHaveURL(/\/groups\/[a-zA-Z0-9-]+/);
    await expect(page.locator('[data-testid=group-name]')).toContainText(testStudyGroups.mathStudyGroup.name);

    // Should show group details
    await expect(page.locator('[data-testid=group-topic]')).toContainText(testStudyGroups.mathStudyGroup.topic);
    await expect(page.locator('[data-testid=group-description]')).toContainText(testStudyGroups.mathStudyGroup.description);
    await expect(page.locator('[data-testid=member-count]')).toContainText('1'); // Creator

    // Should show group management options
    await expect(page.locator('[data-testid=invite-members]')).toBeVisible();
    await expect(page.locator('[data-testid=group-settings]')).toBeVisible();
  });

  test('should join existing study groups', async ({ page, context }) => {
    // First user creates a group
    await dashboardPage.findPeers();
    await collaborationPage.createStudyGroup(testStudyGroups.codingBootcamp);

    // Get group invite link
    await page.locator('[data-testid=invite-members]').click();
    const inviteLink = await page.locator('[data-testid=invite-link]').textContent();

    // Second user joins the group
    const secondPage = await context.newPage();
    const secondLoginPage = new LoginPage(secondPage);
    
    await secondLoginPage.goto();
    await secondLoginPage.login(testUsers.collegeStudent.email, testUsers.collegeStudent.password);
    await secondLoginPage.expectLoginSuccess();

    // Navigate to invite link
    await secondPage.goto(inviteLink || '');

    // Should show group preview
    await expect(secondPage.locator('[data-testid=group-preview]')).toBeVisible();
    await expect(secondPage.locator('[data-testid=group-name]')).toContainText(testStudyGroups.codingBootcamp.name);

    // Join the group
    await secondPage.locator('[data-testid=join-group-button]').click();

    // Should be added to group
    await expect(secondPage.locator('[data-testid=welcome-message]')).toBeVisible();
    await expect(secondPage.locator('[data-testid=member-count]')).toContainText('2');
  });

  test('should facilitate real-time collaboration in study sessions', async ({ page, context }) => {
    // Create study group
    await dashboardPage.findPeers();
    await collaborationPage.createStudyGroup(testStudyGroups.mathStudyGroup);

    // Start collaborative session
    await page.locator('[data-testid=start-session]').click();
    await expect(page.locator('[data-testid=collaboration-session]')).toBeVisible();

    // Should show collaboration tools
    await expect(page.locator('[data-testid=shared-whiteboard]')).toBeVisible();
    await expect(page.locator('[data-testid=screen-share]')).toBeVisible();
    await expect(collaborationPage.chatSection).toBeVisible();

    // Send message in chat
    await collaborationPage.sendMessage('Hello everyone!');
    await collaborationPage.expectMessageSent('Hello everyone!');

    // Simulate second participant joining
    const secondPage = await context.newPage();
    const secondLoginPage = new LoginPage(secondPage);
    
    await secondLoginPage.goto();
    await secondLoginPage.login(testUsers.collegeStudent.email, testUsers.collegeStudent.password);
    
    // Join the same session
    await secondPage.goto(page.url());
    
    // Should see the chat message
    await expect(secondPage.locator('[data-testid=message]:has-text("Hello everyone!")')).toBeVisible();

    // Second user sends message
    const secondCollabPage = new CollaborationPage(secondPage);
    await secondCollabPage.sendMessage('Hi there!');

    // First user should see the new message
    await expect(page.locator('[data-testid=message]:has-text("Hi there!")')).toBeVisible();
  });

  test('should handle peer matching based on learning goals and compatibility', async ({ page }) => {
    await dashboardPage.findPeers();

    // Set matching preferences
    await page.locator('[data-testid=matching-preferences]').click();
    await page.locator('[data-testid=subject-preference]').selectOption('programming');
    await page.locator('[data-testid=skill-level-preference]').selectOption('beginner');
    await page.locator('[data-testid=time-zone-preference]').selectOption('America/New_York');
    await page.locator('[data-testid=save-preferences]').click();

    // Should show filtered peer recommendations
    await expect(page.locator('[data-testid=peer-card]')).toHaveCount(3); // Assuming 3 matches

    // Each peer should show compatibility indicators
    const peerCards = page.locator('[data-testid=peer-card]');
    for (let i = 0; i < await peerCards.count(); i++) {
      const card = peerCards.nth(i);
      await expect(card.locator('[data-testid=compatibility-score]')).toBeVisible();
      await expect(card.locator('[data-testid=shared-interests]')).toContainText('programming');
    }
  });

  test('should enforce safety measures in peer interactions', async ({ page }) => {
    await dashboardPage.findPeers();

    // Should show safety guidelines
    await expect(page.locator('[data-testid=safety-guidelines]')).toBeVisible();

    // Create study group
    await collaborationPage.createStudyGroup(testStudyGroups.mathStudyGroup);

    // Start session and send message
    await page.locator('[data-testid=start-session]').click();
    await collaborationPage.sendMessage('This is a test message');

    // Should show moderation indicators
    await expect(page.locator('[data-testid=message-status]')).toBeVisible();

    // Try to send inappropriate content (simulated)
    await collaborationPage.sendMessage('inappropriate content example');

    // Should be flagged or blocked
    await expect(page.locator('[data-testid=moderation-warning]')).toBeVisible();
  });

  test('should provide reporting and escalation mechanisms', async ({ page }) => {
    await dashboardPage.findPeers();
    await collaborationPage.createStudyGroup(testStudyGroups.codingBootcamp);

    // Should show report options
    await page.locator('[data-testid=group-menu]').click();
    await expect(page.locator('[data-testid=report-group]')).toBeVisible();

    // Report inappropriate behavior
    await page.locator('[data-testid=report-group]').click();
    await page.locator('[data-testid=report-reason]').selectOption('inappropriate_content');
    await page.locator('[data-testid=report-description]').fill('Test report description');
    await page.locator('[data-testid=submit-report]').click();

    // Should confirm report submission
    await expect(page.locator('[data-testid=report-confirmation]')).toBeVisible();
    await expect(page.locator('[data-testid=report-id]')).toBeVisible();
  });

  test('should handle group size limits and member management', async ({ page, context }) => {
    await dashboardPage.findPeers();
    
    // Create group with size limit
    const groupData = { ...testStudyGroups.mathStudyGroup, maxSize: 3 };
    await collaborationPage.createStudyGroup(groupData);

    // Add members up to limit
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-testid=invite-members]').click();
      await page.locator('[data-testid=invite-email]').fill(`user${i}@test.com`);
      await page.locator('[data-testid=send-invite]').click();
    }

    // Should show group is full
    await expect(page.locator('[data-testid=group-full]')).toBeVisible();
    await expect(page.locator('[data-testid=invite-members]')).toBeDisabled();

    // Should show member management options
    await expect(page.locator('[data-testid=member-list]')).toBeVisible();
    await expect(page.locator('[data-testid=remove-member]').first()).toBeVisible();
  });

  test('should track collaboration metrics and effectiveness', async ({ page }) => {
    await dashboardPage.findPeers();
    await collaborationPage.createStudyGroup(testStudyGroups.mathStudyGroup);

    // Start and participate in session
    await page.locator('[data-testid=start-session]').click();
    await collaborationPage.sendMessage('Let\'s solve this problem together');
    
    // Simulate collaboration activity
    await page.locator('[data-testid=shared-whiteboard]').click();
    await page.waitForTimeout(5000); // Simulate active participation

    // End session
    await page.locator('[data-testid=end-session]').click();

    // Should show session summary
    await expect(page.locator('[data-testid=session-summary]')).toBeVisible();
    await expect(page.locator('[data-testid=participation-score]')).toBeVisible();
    await expect(page.locator('[data-testid=collaboration-effectiveness]')).toBeVisible();

    // Navigate to group analytics
    await page.locator('[data-testid=group-analytics]').click();
    await expect(page.locator('[data-testid=group-performance]')).toBeVisible();
    await expect(page.locator('[data-testid=member-contributions]')).toBeVisible();
  });

  test('should support different collaboration formats', async ({ page }) => {
    await dashboardPage.findPeers();
    await collaborationPage.createStudyGroup(testStudyGroups.codingBootcamp);

    // Should offer different session types
    await page.locator('[data-testid=session-type-selector]').click();
    await expect(page.locator('[data-value="study_session"]')).toBeVisible();
    await expect(page.locator('[data-value="code_review"]')).toBeVisible();
    await expect(page.locator('[data-value="project_collaboration"]')).toBeVisible();

    // Start code review session
    await page.locator('[data-value="code_review"]').click();
    await page.locator('[data-testid=start-session]').click();

    // Should show code review interface
    await expect(page.locator('[data-testid=code-editor]')).toBeVisible();
    await expect(page.locator('[data-testid=review-comments]')).toBeVisible();
    await expect(page.locator('[data-testid=file-sharing]')).toBeVisible();
  });

  test('should handle cross-age group interactions safely', async ({ page, context }) => {
    // Login as minor user
    await page.goto('/auth/login');
    await page.locator('[data-testid=email-input]').fill(testUsers.k12Student.email);
    await page.locator('[data-testid=password-input]').fill(testUsers.k12Student.password);
    await page.locator('[data-testid=login-button]').click();

    await dashboardPage.findPeers();

    // Should show age-appropriate matches only
    await expect(page.locator('[data-testid=age-filter-notice]')).toBeVisible();
    
    const peerCards = page.locator('[data-testid=peer-card]');
    for (let i = 0; i < await peerCards.count(); i++) {
      const card = peerCards.nth(i);
      await expect(card.locator('[data-testid=age-appropriate]')).toBeVisible();
    }

    // Should require supervision for interactions
    await page.locator('[data-testid=peer-card]').first().click();
    await expect(page.locator('[data-testid=supervision-required]')).toBeVisible();
  });
});