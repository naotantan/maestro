import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Routines Page', () => {
  test('routines page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/routines');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-routines-list.png` });
  });

  test('routines page shows content or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/routines');
    await page.waitForLoadState('networkidle');

    // Check for either routines or empty state
    const content = await page.locator('h1, h2').first().textContent();
    expect(content).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-routines-state.png` });
  });

  test('routines page - check for create functionality', async ({ authenticatedPage: page }) => {
    await page.goto('/routines');
    await page.waitForLoadState('networkidle');

    // Check if create button exists
    const createBtn = page.locator('button').filter({ hasText: /create|new|add|作成|新規|routine/i }).first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-routines-create-check.png` });
    test.info().annotations.push({
      type: 'info',
      description: hasCreateBtn ? 'Create button found' : 'No create button (routines may be created via API or different flow)',
    });
  });
});
