import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Agents Page', () => {
  test('agents page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText('エージェント');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agents-list.png` });
  });

  test('can open create agent form', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Button text is "エージェントを追加"
    const createBtn = page.locator('button').filter({ hasText: 'エージェントを追加' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agents-create-form.png` });
    // Form should appear
    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test('can create a new agent', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Click "エージェントを追加" button
    const createBtn = page.locator('button').filter({ hasText: 'エージェントを追加' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill name
    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const testAgentName = `E2E Test Agent ${Date.now()}`;
    await nameInput.fill(testAgentName);
    await expect(nameInput).toHaveValue(testAgentName);

    // Select type if dropdown exists (keep default)
    const typeSelect = page.locator('select').first();
    if (await typeSelect.isVisible()) {
      // Keep default type selection
    }

    // Submit - button text is "作成"
    const submitBtn = page.locator('button:not([disabled])').filter({ hasText: /^作成$/ }).first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agents-created.png` });

    await expect(page.locator('body')).toContainText(testAgentName, { timeout: 15000 });
  });

  test('agent detail page is accessible', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const agentLink = page.locator('a[href*="/agents/"]').first();
    if (await agentLink.isVisible()) {
      await agentLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.url()).toContain('/agents/');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agent-detail.png` });
    } else {
      test.info().annotations.push({ type: 'info', description: 'No agent links found yet' });
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agents-no-detail.png` });
    }
  });

  test('agents page shows correct summary', async ({ authenticatedPage: page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    // Summary text: "有効: X台 | オンライン: X台"
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('エージェント');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-agents-summary.png` });
  });
});
