import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Dashboard page
 *
 * Encapsulates all dashboard page interactions for maintainable E2E tests.
 * Uses role-based selectors for resilience against UI changes.
 */
export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly reportsCard: Locator;
  readonly successfulCard: Locator;
  readonly failedCard: Locator;
  readonly connectorsCard: Locator;
  readonly scheduledReportsSection: Locator;
  readonly quickStartSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Dashboard' });
    // Stats cards - they contain the stat name text
    this.reportsCard = page.locator('a[href="/reports"]').filter({ hasText: 'Reports' });
    this.successfulCard = page.locator('a[href="/runs"]').filter({ hasText: 'Successful' });
    this.failedCard = page.locator('a[href="/runs"]').filter({ hasText: 'Failed' });
    this.connectorsCard = page.locator('a[href="/connectors"]').filter({ hasText: 'Connectors' });
    this.scheduledReportsSection = page.getByText('Scheduled Reports');
    this.quickStartSection = page.getByRole('heading', { name: 'Quick Start' });
  }

  /**
   * Navigate to the dashboard
   */
  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Assert that the dashboard has loaded with expected elements
   */
  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.quickStartSection).toBeVisible();
  }

  /**
   * Get the value from a summary card by name
   */
  async getSummaryCardValue(cardName: 'Reports' | 'Successful' | 'Failed' | 'Connectors'): Promise<string> {
    const card = {
      'Reports': this.reportsCard,
      'Successful': this.successfulCard,
      'Failed': this.failedCard,
      'Connectors': this.connectorsCard,
    }[cardName];

    // The card contains a number (the stat value) and the label
    const textContent = await card.textContent();
    // Extract the number from the text content
    const match = textContent?.match(/\d+/);
    return match ? match[0] : '0';
  }

  /**
   * Navigate to the Reports page via sidebar link
   */
  async navigateToReports() {
    await this.page.getByRole('link', { name: 'Reports' }).first().click();
    await expect(this.page).toHaveURL('/reports');
  }

  /**
   * Navigate to the Runs page via sidebar link
   */
  async navigateToRuns() {
    await this.page.getByRole('link', { name: 'Runs' }).click();
    await expect(this.page).toHaveURL('/runs');
  }

  /**
   * Click on a quick start link
   */
  async clickQuickStartLink(linkText: string) {
    await this.page.getByRole('link', { name: linkText }).click();
  }
}
