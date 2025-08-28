import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for E2E tests
 */

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[data-testid=email-input]');
    this.passwordInput = page.locator('[data-testid=password-input]');
    this.loginButton = page.locator('[data-testid=login-button]');
    this.registerLink = page.locator('[data-testid=register-link]');
    this.errorMessage = page.locator('[data-testid=error-message]');
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL('/dashboard');
  }

  async expectLoginError() {
    await expect(this.errorMessage).toBeVisible();
  }
}

export class RegisterPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly ageRangeSelect: Locator;
  readonly educationLevelSelect: Locator;
  readonly registerButton: Locator;
  readonly termsCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.locator('[data-testid=first-name-input]');
    this.lastNameInput = page.locator('[data-testid=last-name-input]');
    this.emailInput = page.locator('[data-testid=email-input]');
    this.passwordInput = page.locator('[data-testid=password-input]');
    this.confirmPasswordInput = page.locator('[data-testid=confirm-password-input]');
    this.ageRangeSelect = page.locator('[data-testid=age-range-select]');
    this.educationLevelSelect = page.locator('[data-testid=education-level-select]');
    this.registerButton = page.locator('[data-testid=register-button]');
    this.termsCheckbox = page.locator('[data-testid=terms-checkbox]');
  }

  async goto() {
    await this.page.goto('/auth/register');
  }

  async register(userData: any) {
    await this.firstNameInput.fill(userData.firstName);
    await this.lastNameInput.fill(userData.lastName);
    await this.emailInput.fill(userData.email);
    await this.passwordInput.fill(userData.password);
    await this.confirmPasswordInput.fill(userData.password);
    
    // Select age range and education level
    await this.ageRangeSelect.click();
    await this.page.locator(`[data-value="${userData.ageRange}"]`).click();
    
    await this.educationLevelSelect.click();
    await this.page.locator(`[data-value="${userData.educationLevel}"]`).click();
    
    await this.termsCheckbox.check();
    await this.registerButton.click();
  }
}

export class OnboardingPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly learningGoalsSection: Locator;
  readonly nextButton: Locator;
  readonly skipButton: Locator;
  readonly completeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator('[data-testid=welcome-message]');
    this.learningGoalsSection = page.locator('[data-testid=learning-goals-section]');
    this.nextButton = page.locator('[data-testid=next-button]');
    this.skipButton = page.locator('[data-testid=skip-button]');
    this.completeButton = page.locator('[data-testid=complete-onboarding]');
  }

  async selectLearningGoals(goals: string[]) {
    for (const goal of goals) {
      await this.page.locator(`[data-testid=goal-${goal}]`).click();
    }
  }

  async completeOnboarding() {
    await this.completeButton.click();
    await expect(this.page).toHaveURL('/dashboard');
  }
}

export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly progressSection: Locator;
  readonly learningPathsSection: Locator;
  readonly continueButton: Locator;
  readonly exploreContentButton: Locator;
  readonly findPeersButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator('[data-testid=welcome-message]');
    this.progressSection = page.locator('[data-testid=progress-section]');
    this.learningPathsSection = page.locator('[data-testid=learning-paths-section]');
    this.continueButton = page.locator('[data-testid=continue-learning]');
    this.exploreContentButton = page.locator('[data-testid=explore-content]');
    this.findPeersButton = page.locator('[data-testid=find-peers]');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async startLearningSession() {
    await this.continueButton.click();
  }

  async exploreContent() {
    await this.exploreContentButton.click();
  }

  async findPeers() {
    await this.findPeersButton.click();
  }
}

export class LearningSessionPage {
  readonly page: Page;
  readonly contentPlayer: Locator;
  readonly progressBar: Locator;
  readonly nextContentButton: Locator;
  readonly markCompleteButton: Locator;
  readonly assessmentSection: Locator;
  readonly submitAssessmentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.contentPlayer = page.locator('[data-testid=content-player]');
    this.progressBar = page.locator('[data-testid=progress-bar]');
    this.nextContentButton = page.locator('[data-testid=next-content]');
    this.markCompleteButton = page.locator('[data-testid=mark-complete]');
    this.assessmentSection = page.locator('[data-testid=assessment-section]');
    this.submitAssessmentButton = page.locator('[data-testid=submit-assessment]');
  }

  async completeContent() {
    await this.markCompleteButton.click();
  }

  async takeAssessment(answers: number[]) {
    for (let i = 0; i < answers.length; i++) {
      const questionLocator = this.page.locator(`[data-testid=question-${i}]`);
      const optionLocator = questionLocator.locator(`[data-testid=option-${answers[i]}]`);
      await optionLocator.click();
    }
    await this.submitAssessmentButton.click();
  }

  async expectProgressUpdate() {
    await expect(this.progressBar).not.toHaveAttribute('aria-valuenow', '0');
  }
}

export class ContentDiscoveryPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly filterSection: Locator;
  readonly contentGrid: Locator;
  readonly contentItem: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('[data-testid=search-input]');
    this.searchButton = page.locator('[data-testid=search-button]');
    this.filterSection = page.locator('[data-testid=filter-section]');
    this.contentGrid = page.locator('[data-testid=content-grid]');
    this.contentItem = page.locator('[data-testid=content-item]');
  }

  async searchContent(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async applyFilter(filterType: string, value: string) {
    await this.page.locator(`[data-testid=filter-${filterType}]`).click();
    await this.page.locator(`[data-value="${value}"]`).click();
  }

  async selectContent(index: number = 0) {
    await this.contentItem.nth(index).click();
  }

  async expectContentResults() {
    await expect(this.contentItem.first()).toBeVisible();
  }
}

export class CollaborationPage {
  readonly page: Page;
  readonly peerMatchingSection: Locator;
  readonly studyGroupsSection: Locator;
  readonly createGroupButton: Locator;
  readonly joinGroupButton: Locator;
  readonly chatSection: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.peerMatchingSection = page.locator('[data-testid=peer-matching-section]');
    this.studyGroupsSection = page.locator('[data-testid=study-groups-section]');
    this.createGroupButton = page.locator('[data-testid=create-group]');
    this.joinGroupButton = page.locator('[data-testid=join-group]');
    this.chatSection = page.locator('[data-testid=chat-section]');
    this.messageInput = page.locator('[data-testid=message-input]');
    this.sendButton = page.locator('[data-testid=send-message]');
  }

  async createStudyGroup(groupData: any) {
    await this.createGroupButton.click();
    
    await this.page.locator('[data-testid=group-name-input]').fill(groupData.name);
    await this.page.locator('[data-testid=group-topic-select]').click();
    await this.page.locator(`[data-value="${groupData.topic}"]`).click();
    await this.page.locator('[data-testid=group-description-input]').fill(groupData.description);
    
    await this.page.locator('[data-testid=create-group-submit]').click();
  }

  async joinStudyGroup(groupName: string) {
    const groupCard = this.page.locator(`[data-testid=group-card]:has-text("${groupName}")`);
    await groupCard.locator('[data-testid=join-group]').click();
  }

  async sendMessage(message: string) {
    await this.messageInput.fill(message);
    await this.sendButton.click();
  }

  async expectMessageSent(message: string) {
    await expect(this.page.locator(`[data-testid=message]:has-text("${message}")`)).toBeVisible();
  }
}