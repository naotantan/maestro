import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Goals Page', () => {
  test('goals page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Page title should be "ゴール"
    await expect(page.locator('h1')).toContainText('ゴール');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-goals-list.png` });
  });

  test('can open create goal form', async ({ authenticatedPage: page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');

    // Button text is "ゴールを作成"
    const createBtn = page.locator('button').filter({ hasText: 'ゴールを作成' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-goals-create-form.png` });
    // Form should appear with a name input
    await expect(page.locator('input[placeholder*="月間"]')).toBeVisible({ timeout: 5000 });
  });

  test('can create a new goal', async ({ authenticatedPage: page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');

    // Click "ゴールを作成" button
    const createBtn = page.locator('button').filter({ hasText: 'ゴールを作成' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill name in the "例: 月間売上100万円達成" placeholder input
    const nameInput = page.locator('input[placeholder*="月間"], input[placeholder*="名前"], input[placeholder*="goal" i]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const testGoalName = `E2E Test Goal ${Date.now()}`;
    await nameInput.fill(testGoalName);
    await expect(nameInput).toHaveValue(testGoalName);

    // Click the submit button - text is "作成" (common.create)
    const submitBtn = page.locator('button:not([disabled])').filter({ hasText: /^作成$/ }).first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-goals-created.png` });

    // Verify goal appears in list
    await expect(page.locator('body')).toContainText(testGoalName, { timeout: 15000 });
  });

  test('goals page shows empty state or list', async ({ authenticatedPage: page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');
    // Either shows goals or the empty state icon 🎯
    const bodyText = await page.locator('body').textContent() ?? '';
    const hasContent = bodyText.includes('ゴール');
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-goals-state.png` });
  });
});
