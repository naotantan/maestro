import { test, expect, SCREENSHOTS_DIR } from './fixtures';

test.describe('Projects Page', () => {
  test('projects page loads', async ({ authenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page.url()).not.toContain('/login');
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    // Page title should be "プロジェクト"
    await expect(page.locator('h1')).toContainText('プロジェクト');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-projects-list.png` });
  });

  test('can create a new project', async ({ authenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Button text is "プロジェクトを作成"
    const createBtn = page.locator('button').filter({ hasText: 'プロジェクトを作成' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Fill project name
    const nameInput = page.locator('input[placeholder]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const testProjectName = `E2E Test Project ${Date.now()}`;
    await nameInput.fill(testProjectName);
    await expect(nameInput).toHaveValue(testProjectName);

    // Submit - button text is "作成"
    const submitBtn = page.locator('button:not([disabled])').filter({ hasText: /^作成$/ }).first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-projects-created.png` });

    // Verify project appears in list
    await expect(page.locator('body')).toContainText(testProjectName, { timeout: 15000 });
  });

  test('project detail page is accessible', async ({ authenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Click on first project link if exists
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page.url()).toContain('/projects/');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-project-detail.png` });
    } else {
      // Try clicking on a project card
      const projectCard = page.locator('.project-card, [data-testid="project-card"]').first();
      if (await projectCard.isVisible()) {
        await projectCard.click();
        await page.waitForLoadState('networkidle');
      }
      test.info().annotations.push({ type: 'info', description: 'No project links found' });
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-projects-no-detail.png` });
    }
  });

  test('projects page shows empty state or list', async ({ authenticatedPage: page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('プロジェクト');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-projects-state.png` });
  });
});
