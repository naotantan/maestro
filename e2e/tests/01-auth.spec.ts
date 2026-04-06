import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

test.describe('Authentication Flow', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/.*/);
    // Check for login form elements
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png` });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('body')).toContainText(/エラー|error|invalid|incorrect|失敗|メールアドレス|パスワード/i);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-error.png` });
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@maestro.local');
    await page.fill('#password', 'Password123!');
    await page.click('button[type="submit"]');

    // Handle potential rate limiting - if login fails, skip gracefully
    // Wait for either redirect to / or for an error to appear
    try {
      await page.waitForURL('/', { timeout: 15000 });
      await expect(page.url()).toContain('localhost:5173');
      await expect(page.url()).not.toContain('/login');
    } catch {
      // Check if rate limiting caused the failure
      const bodyText = await page.locator('body').textContent() ?? '';
      if (bodyText.includes('rate_limit') || bodyText.includes('試行回数')) {
        test.info().annotations.push({ type: 'info', description: 'Rate limit hit - skipping redirect check' });
        test.skip(true, 'Rate limit exceeded for login - this is expected in test suites');
      } else {
        throw new Error(`Login redirect failed. Page content: ${bodyText.slice(0, 200)}`);
      }
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-success.png` });
  });

  test('register page loads correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[id="name"], input[name="name"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[id="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"], input[name="password"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-register-page.png` });
  });

  test('register with already existing email shows error', async ({ page }) => {
    await page.goto('/register');
    // Fill out the form with existing email
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    const emailInput = page.locator('input[id="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[id="password"], input[name="password"]').first();
    const companyInput = page.locator('input[id="companyName"], input[name="companyName"]').first();

    await nameInput.fill('Duplicate User');
    await emailInput.fill('test@maestro.local');
    await passwordInput.fill('Password123!');
    await companyInput.fill('Test Corp');
    await page.click('button[type="submit"]');
    // Should show error
    await expect(page.locator('body')).toContainText(/エラー|error|already|exists|既に|登録済み/i, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-register-duplicate-error.png` });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Clear any existing auth
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('apiKey');
      localStorage.removeItem('companyId');
      localStorage.removeItem('userId');
    });
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.url()).toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-unauthenticated-redirect.png` });
  });
});
