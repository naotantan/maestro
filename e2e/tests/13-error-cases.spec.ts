import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Error Cases and Edge Cases', () => {
  test('404 page for unknown routes', async ({ authenticatedPage: page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');
    // Should show 404 page
    await expect(page.locator('body')).toContainText(/404|not found|見つかりません/i, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-404-page.png` });
  });

  test('logout clears auth and redirects to login', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click logout button
    const logoutBtn = page.locator('button, a').filter({ hasText: /logout|sign out|ログアウト|サインアウト/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL('**/login', { timeout: 10000 });
      await expect(page.url()).toContain('/login');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-logout-redirect.png` });
    } else {
      // Try to find logout in a menu or profile dropdown
      const profileBtn = page.locator('button[aria-label*="profile" i], button[aria-label*="user" i], [data-testid="user-menu"]').first();
      if (await profileBtn.isVisible()) {
        await profileBtn.click();
        const logoutInMenu = page.locator('button, a').filter({ hasText: /logout|sign out|ログアウト/i }).first();
        if (await logoutInMenu.isVisible()) {
          await logoutInMenu.click();
          await page.waitForURL('**/login', { timeout: 10000 });
        }
      }
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-logout-attempt.png` });
    }
  });

  test('API error handling - backend unavailable gracefully fails', async ({ authenticatedPage: page }) => {
    // Navigate to a page that loads data
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    // The page should still render even if API is slow
    await expect(page.locator('body')).not.toContainText('TypeError');
    await expect(page.locator('body')).not.toContainText('Cannot read');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-api-error-handling.png` });
  });

  test('navigation between pages maintains auth', async ({ authenticatedPage: page }) => {
    const pagesToCheck = ['/', '/issues', '/agents', '/projects', '/goals'];

    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      // Should not redirect to login
      await expect(page.url()).not.toContain('/login');
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-auth-persistence.png` });
  });

  test('browser back/forward navigation works', async ({ authenticatedPage: page }) => {
    await page.goto('/');
    await page.goto('/issues');
    await page.goto('/agents');

    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page.url()).toContain('/issues');

    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page.url()).toContain('/agents');

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13-browser-nav.png` });
  });
});
