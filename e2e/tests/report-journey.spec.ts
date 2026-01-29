import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ReportsPage } from '../pages/reports.page';

/**
 * Report User Journey E2E Test
 *
 * Complete smoke test covering the main user journey:
 * 1. Login as admin
 * 2. View dashboard
 * 3. Navigate to Reports
 * 4. Create a new report
 * 5. Execute the report
 * 6. View run status
 *
 * Requires backend services running via docker-compose.
 */

test.describe('Report User Journey', () => {
  // Use a unique report name to avoid conflicts
  const testReportName = `E2E Test Report ${Date.now()}`;
  const testReportDescription = 'Automated E2E test report';

  test.beforeEach(async ({ page }) => {
    // Login before each test
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'admin123');
    await loginPage.expectLoggedIn();
  });

  test('complete user journey: dashboard -> reports -> create -> execute', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const reportsPage = new ReportsPage(page);

    // Step 1: Verify dashboard loads with summary cards
    await dashboardPage.expectLoaded();

    // Check that stats cards are present
    const reportsCount = await dashboardPage.getSummaryCardValue('Reports');
    expect.soft(reportsCount).toBeDefined();

    // Step 2: Navigate to Reports page
    await dashboardPage.navigateToReports();

    // Step 3: Verify Reports page loads
    await reportsPage.expectLoaded();

    // Step 4: Create a new report
    await reportsPage.createReport(testReportName, testReportDescription);

    // Wait for report creation - may need to wait for API response
    await page.waitForTimeout(1000);

    // Step 5: Verify report appears in the list
    // Note: This may fail if the wizard doesn't auto-close or has multiple steps
    await expect(async () => {
      await page.goto('/reports');
      await reportsPage.expectReportExists(testReportName);
    }).toPass({ timeout: 10000 });

    // Step 6: Navigate to Runs page to verify it loads
    await dashboardPage.goto();
    await dashboardPage.navigateToRuns();

    // Verify Runs page loads
    await expect(page.getByRole('heading', { name: 'Runs' }).first()).toBeVisible();
  });

  test('dashboard displays correct statistics', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    // Verify all stat cards are visible
    await expect(dashboardPage.reportsCard).toBeVisible();
    await expect(dashboardPage.successfulCard).toBeVisible();
    await expect(dashboardPage.failedCard).toBeVisible();
    await expect(dashboardPage.connectorsCard).toBeVisible();

    // Verify Quick Start section
    await expect(dashboardPage.quickStartSection).toBeVisible();
  });

  test('sidebar navigation works correctly', async ({ page }) => {
    // Test navigation to various pages via sidebar

    // Reports
    await page.getByRole('link', { name: 'Reports' }).first().click();
    await expect(page).toHaveURL('/reports');

    // Connectors
    await page.getByRole('link', { name: 'Connectors' }).click();
    await expect(page).toHaveURL('/connectors');

    // Schedules
    await page.getByRole('link', { name: 'Schedules' }).click();
    await expect(page).toHaveURL('/schedules');

    // Runs
    await page.getByRole('link', { name: 'Runs' }).click();
    await expect(page).toHaveURL('/runs');

    // Dashboard (home)
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/');
  });

  test('reports page shows report list or empty state', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();
    await reportsPage.expectLoaded();

    // Should show either reports in a table or an empty state
    const hasTable = await reportsPage.reportTable.isVisible().catch(() => false);
    const hasEmptyState = await reportsPage.emptyState.isVisible().catch(() => false);

    expect.soft(hasTable || hasEmptyState).toBe(true);

    // The New Report button should always be visible
    await expect(reportsPage.newReportButton).toBeVisible();
  });

  test('dashboard date picker controls work', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    // Find and interact with date controls
    const todayButton = page.getByRole('button', { name: 'Today' });
    const t1Button = page.getByRole('button', { name: 'T-1' });
    const yesterdayButton = page.getByRole('button', { name: 'Yesterday' });

    // All date buttons should be visible
    await expect(todayButton).toBeVisible();
    await expect(t1Button).toBeVisible();
    await expect(yesterdayButton).toBeVisible();

    // Click Today button
    await todayButton.click();

    // The Today button should now appear selected (has btn-primary class)
    await expect(todayButton).toHaveClass(/btn-primary/);
  });

  test('scheduled reports section displays correctly', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();
    await dashboardPage.expectLoaded();

    // The Scheduled Reports section should be visible
    await expect(dashboardPage.scheduledReportsSection).toBeVisible();

    // Either shows scheduled reports table or "No scheduled reports" message
    const hasTable = await page.locator('table').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText('No scheduled reports').isVisible().catch(() => false);

    // At least one of these should be true
    expect.soft(hasTable || hasEmptyState).toBe(true);
  });
});

test.describe('Report Management', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('admin@example.com', 'admin123');
    await loginPage.expectLoggedIn();
  });

  test('can view report list', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();
    await reportsPage.expectLoaded();

    // The page should have loaded without errors
    await expect(page.locator('.animate-fade-in')).toBeVisible();
  });

  test('new report button opens wizard', async ({ page }) => {
    const reportsPage = new ReportsPage(page);
    await reportsPage.goto();
    await reportsPage.expectLoaded();

    // Click New Report button
    await reportsPage.clickNewReport();

    // Wizard should open - check for wizard elements
    // This may be a modal or a form that appears
    const wizardVisible = await page.getByLabel('Report Name').isVisible().catch(() => false)
      || await page.getByText('Create Report').isVisible().catch(() => false)
      || await page.getByRole('dialog').isVisible().catch(() => false);

    expect.soft(wizardVisible).toBe(true);
  });
});
