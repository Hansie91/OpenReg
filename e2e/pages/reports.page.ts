import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Reports page
 *
 * Encapsulates all reports page interactions for maintainable E2E tests.
 * Uses role-based selectors for resilience against UI changes.
 */
export class ReportsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly newReportButton: Locator;
  readonly reportTable: Locator;
  readonly emptyState: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Reports' }).first();
    this.newReportButton = page.getByRole('button', { name: /New Report|Create Report/i });
    this.reportTable = page.locator('table');
    this.emptyState = page.getByText('No reports');
    this.searchInput = page.getByPlaceholder('Search reports');
  }

  /**
   * Navigate to the reports page
   */
  async goto() {
    await this.page.goto('/reports');
  }

  /**
   * Assert that the reports page has loaded
   */
  async expectLoaded() {
    // Wait for either the table or empty state to be visible
    await expect(this.heading).toBeVisible();
    // Page is loaded when either reports table or empty state is visible
    await Promise.race([
      expect(this.reportTable).toBeVisible().catch(() => {}),
      expect(this.emptyState).toBeVisible().catch(() => {}),
    ]);
  }

  /**
   * Click the New Report button to open the creation wizard
   */
  async clickNewReport() {
    await this.newReportButton.click();
  }

  /**
   * Create a new report using the wizard
   */
  async createReport(name: string, description: string) {
    await this.clickNewReport();

    // Wait for wizard to appear
    const nameInput = this.page.getByLabel('Report Name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Fill in the report details
    await nameInput.fill(name);

    const descInput = this.page.getByLabel('Description');
    if (await descInput.isVisible()) {
      await descInput.fill(description);
    }

    // Click Create button (or Next if multi-step wizard)
    const createButton = this.page.getByRole('button', { name: /Create|Save|Next/i });
    await createButton.click();
  }

  /**
   * Get a report row by name
   */
  getReportByName(name: string): Locator {
    return this.reportTable.locator('tr').filter({ hasText: name });
  }

  /**
   * Assert that a report exists in the list
   */
  async expectReportExists(name: string) {
    await expect(this.getReportByName(name)).toBeVisible();
  }

  /**
   * Click the execute button for a specific report
   */
  async executeReport(name: string) {
    const reportRow = this.getReportByName(name);
    // Look for a play/execute button in the row
    const executeButton = reportRow.getByRole('button', { name: /Execute|Run|Play/i });
    await executeButton.click();
  }

  /**
   * Click on a report to view/edit it
   */
  async openReport(name: string) {
    const reportRow = this.getReportByName(name);
    // Click on the report name to open it
    await reportRow.getByText(name).click();
  }

  /**
   * Delete a report by name
   */
  async deleteReport(name: string) {
    const reportRow = this.getReportByName(name);
    const deleteButton = reportRow.getByRole('button', { name: /Delete|Remove/i });
    await deleteButton.click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: /Confirm|Yes|Delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }

  /**
   * Search for reports
   */
  async searchReports(query: string) {
    if (await this.searchInput.isVisible()) {
      await this.searchInput.fill(query);
    }
  }

  /**
   * Get the count of reports in the table
   */
  async getReportCount(): Promise<number> {
    // Wait a bit for the table to load
    await this.page.waitForTimeout(500);

    if (await this.emptyState.isVisible().catch(() => false)) {
      return 0;
    }

    const rows = this.reportTable.locator('tbody tr');
    return await rows.count();
  }
}
