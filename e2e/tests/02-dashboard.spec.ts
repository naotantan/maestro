import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Dashboard', () => {
  test('dashboard loads after login', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Error');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard.png` });
  });

  test('dashboard shows main navigation', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Navigation should be visible (sidebar or top nav)
    const nav = page.locator('nav, aside, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard-nav.png` });
  });

  test('dashboard does not show 404', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('Not Found');
  });
});
