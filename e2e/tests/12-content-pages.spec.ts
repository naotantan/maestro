import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Content/Resource Pages', () => {
  test('playbooks page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/playbooks');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-playbooks.png` });
  });

  test('skills page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/skills');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-skills.png` });
  });

  test('plugins page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-plugins.png` });
  });

  test('recipes page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/recipes');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-recipes.png` });
  });

  test('memory page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/memory');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-memory.png` });
  });

  test('sessions page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-sessions.png` });
  });

  test('artifacts page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/artifacts');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-artifacts.png` });
  });

  test('analytics page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-analytics.png` });
  });

  test('webhooks page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-webhooks.png` });
  });

  test('costs page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/costs');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-costs.png` });
  });

  test('activity page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/activity');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-activity.png` });
  });

  test('approvals page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/approvals');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12-approvals.png` });
  });
});
