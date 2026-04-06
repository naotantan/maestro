import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Settings and Organization Pages', () => {
  test('settings page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-settings.png` });
  });

  test('settings page shows configuration options', async ({ authenticatedPage: page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Settings should have some form elements or tabs
    const hasContent = await page.locator('input, select, [role="tab"], button').count() > 0;
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-settings-content.png` });
  });

  test('organization page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/org');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-org.png` });
  });

  test('organization page shows org info', async ({ authenticatedPage: page }) => {
    await page.goto('/org');
    await page.waitForLoadState('networkidle');
    // Should show organization name or details
    await expect(page.locator('body')).toContainText(/test corp|organization|組織|org/i, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-org-info.png` });
  });

  test('notifications page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-notifications.png` });
  });

  test('search page loads and accepts input', async ({ authenticatedPage: page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');

    // Search should have an input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="検索"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-search-results.png` });
    } else {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/11-search-empty.png` });
    }
  });
});
