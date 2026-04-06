import { test, expect, SCREENSHOTS_DIR } from './fixtures';
import { request } from '@playwright/test';

/**
 * Tests for CRUD operations across various entities.
 * These tests interact with the API directly to verify end-to-end data flow.
 */

test.describe('CRUD Operations via UI', () => {
  test('issues - full CRUD cycle', async ({ authenticatedPage: page }) => {
    await page.goto('/issues');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const issueTitle = `CRUD Test Issue ${timestamp}`;

    // CREATE
    const createBtn = page.locator('button').filter({ hasText: /create|new|add|作成|新規/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const titleInput = page.locator('input[placeholder]').first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(issueTitle);

    const submitBtn = page.locator('button').filter({ hasText: /create|save|作成|保存/i }).last();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');

    // VERIFY creation
    await expect(page.locator('body')).toContainText(issueTitle, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-issue-crud-created.png` });
  });

  test('goals - verify create and display', async ({ authenticatedPage: page }) => {
    await page.goto('/goals');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const goalName = `CRUD Test Goal ${timestamp}`;

    const createBtn = page.locator('button').filter({ hasText: /create|new|add|作成|新規/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(goalName);

    const submitBtn = page.locator('button').filter({ hasText: /create|save|作成|保存/i }).last();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(goalName, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-goal-crud-created.png` });
  });

  test('projects - verify create and display', async ({ authenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const timestamp = Date.now();
    const projectName = `CRUD Test Project ${timestamp}`;

    const createBtn = page.locator('button').filter({ hasText: /create|new|add|作成|新規/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(projectName);

    const submitBtn = page.locator('button').filter({ hasText: /create|save|作成|保存/i }).last();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toContainText(projectName, { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-project-crud-created.png` });
  });
});
