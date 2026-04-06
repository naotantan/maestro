import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Jobs Page', () => {
  test('jobs page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-jobs-list.png` });
  });

  test('can open create job modal via "新規ジョブ" button', async ({ authenticatedPage: page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Button text is "新規ジョブ"
    const createBtn = page.locator('button').filter({ hasText: '新規ジョブ' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Modal should appear
    await expect(page.locator('h2').filter({ hasText: '新規ジョブ' })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-jobs-create-modal.png` });
  });

  test('job submit button is disabled without prompt', async ({ authenticatedPage: page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: '新規ジョブ' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // "送信" button should be disabled when prompt is empty
    const submitBtn = page.locator('button').filter({ hasText: '送信' }).first();
    await expect(submitBtn).toBeDisabled({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-jobs-validation.png` });
  });

  test('can fill and submit job creation form', async ({ authenticatedPage: page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: '新規ジョブ' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill prompt
    const promptTextarea = page.locator('textarea#job-prompt, textarea[id="job-prompt"]');
    await expect(promptTextarea).toBeVisible({ timeout: 5000 });
    await promptTextarea.fill('E2E test: analyze the current system status');

    // Submit button should now be enabled
    const submitBtn = page.locator('button').filter({ hasText: '送信' }).first();
    await expect(submitBtn).not.toBeDisabled({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-jobs-prompt-filled.png` });

    // Note: We don't submit to avoid creating actual jobs, just verify the form works
  });

  test('jobs page modal can be closed with cancel', async ({ authenticatedPage: page }) => {
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button').filter({ hasText: '新規ジョブ' }).first();
    await createBtn.click();

    // Modal is visible
    await expect(page.locator('h2').filter({ hasText: '新規ジョブ' })).toBeVisible({ timeout: 5000 });

    // Click cancel
    const cancelBtn = page.locator('button').filter({ hasText: 'キャンセル' }).first();
    await cancelBtn.click();

    // Modal should close
    await expect(page.locator('h2').filter({ hasText: '新規ジョブ' })).not.toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-jobs-modal-closed.png` });
  });
});
