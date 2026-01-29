import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Login page
 *
 * Encapsulates all login page interactions for maintainable E2E tests.
 * Uses role-based selectors for resilience against UI changes.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.locator('.bg-red-50');
    this.heading = page.getByText('Sign in to your account');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto('/login');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Fill in credentials and submit the login form
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /**
   * Assert that an error message is displayed
   */
  async expectError(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  /**
   * Assert that login was successful (redirected to dashboard)
   */
  async expectLoggedIn() {
    // After successful login, user is redirected to dashboard
    await expect(this.page).toHaveURL('/');
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }

  /**
   * Assert that the login page is displayed
   */
  async expectLoginPage() {
    await expect(this.page).toHaveURL('/login');
    await expect(this.heading).toBeVisible();
  }
}
