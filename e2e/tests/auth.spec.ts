import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

/**
 * Authentication E2E Tests
 *
 * Tests for login/logout flows.
 * Requires backend services running via docker-compose for full E2E testing.
 */

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should display login page with sign in form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Verify login form elements are visible
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.submitButton).toBeVisible();
      await expect(loginPage.heading).toBeVisible();
    });

    test('should show demo credentials on login page', async ({ page }) => {
      await page.goto('/login');

      // Verify demo credentials are displayed
      await expect(page.getByText('Demo Credentials')).toBeVisible();
      await expect(page.getByText('admin@example.com / admin123')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Attempt login with invalid credentials
      await loginPage.login('invalid@example.com', 'wrongpassword');

      // Should show error message
      await loginPage.expectError();
    });

    test('should redirect to dashboard on successful login', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Login with demo credentials
      await loginPage.login('admin@example.com', 'admin123');

      // Should be redirected to dashboard
      await loginPage.expectLoggedIn();
    });

    test('should preserve login state after page refresh', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      // Login first
      await loginPage.goto();
      await loginPage.login('admin@example.com', 'admin123');
      await loginPage.expectLoggedIn();

      // Refresh the page
      await page.reload();

      // Should still be on dashboard
      await dashboardPage.expectLoaded();
    });
  });

  test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('admin@example.com', 'admin123');
      await loginPage.expectLoggedIn();
    });

    test('should return to login page on logout', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Click the Sign Out button in the sidebar
      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Should be redirected to login page
      await loginPage.expectLoginPage();
    });

    test('should not be able to access dashboard after logout', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Logout
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await loginPage.expectLoginPage();

      // Try to navigate to dashboard directly
      await page.goto('/');

      // Should be redirected back to login
      await loginPage.expectLoginPage();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      const loginPage = new LoginPage(page);

      // Try to access protected routes directly
      await page.goto('/');
      await loginPage.expectLoginPage();

      await page.goto('/reports');
      await loginPage.expectLoginPage();

      await page.goto('/runs');
      await loginPage.expectLoginPage();
    });
  });
});
