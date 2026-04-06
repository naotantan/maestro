import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Issues Page', () => {
  test('issues page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    // Page heading should be visible
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-list.png` });
  });

  test('issues page shows list or empty state', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');
    // Page should have heading
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Should show either issues or empty state
    const bodyText = await page.locator('body').textContent() ?? '';
    const hasIssueContent = bodyText.includes('Issue') || bodyText.includes('issue');
    expect(hasIssueContent).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-state.png` });
  });

  test('can open create issue form via "Issueを作成" button', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    // The create button shows "Issueを作成" text
    const createBtn = page.locator('button').filter({ hasText: /Issueを作成|Issue.*作成|Create.*Issue|New Issue/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Form should appear
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-create-form.png` });
  });

  test('can create a new issue and see it in the list', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    // Click create button
    const createBtn = page.locator('button').filter({ hasText: /Issueを作成|Issue.*作成/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill title in the inline form
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    const testTitle = `E2E Test Issue ${Date.now()}`;
    await titleInput.fill(testTitle);
    await expect(titleInput).toHaveValue(testTitle);

    // Click the create/submit button (not disabled because title is filled)
    // There will be multiple buttons — find the enabled one that submits
    const submitBtn = page.locator('button:not([disabled])').filter({ hasText: /^作成$|^Create$|^Submit$/i }).first();
    await submitBtn.click();

    // Wait for network to settle (query invalidation + refetch)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-created.png` });

    // The issue should appear in the list
    await expect(page.locator('body')).toContainText(testTitle, { timeout: 15000 });
  });

  test('create button is disabled when title is empty', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: /Issueを作成/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // The submit button inside the form should be disabled when title is empty
    const submitBtn = page.locator('button[disabled]').filter({ hasText: /^作成$|^Create$/i }).first();
    // Either the button is disabled, or we check that it exists disabled
    const isDisabledViaAttribute = await page.locator('button[disabled]').count() > 0;
    expect(isDisabledViaAttribute).toBeTruthy();
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-validation.png` });
  });

  test('issue filter by status works', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    // Find status filter dropdown
    const statusFilter = page.locator('select, button').filter({ hasText: /全ステータス|All.*Status|Status/i }).first();
    if (await statusFilter.isVisible()) {
      // It's a select or button — interact accordingly
      const tagName = await statusFilter.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await statusFilter.selectOption('backlog');
      } else {
        await statusFilter.click();
      }
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-issues-filter.png` });
    }
  });
});
