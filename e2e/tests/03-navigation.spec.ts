import { test, expect, SCREENSHOTS_DIR } from './fixtures';

const pages = [
  { path: '/activity', name: 'Activity' },
  { path: '/approvals', name: 'Approvals' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/artifacts', name: 'Artifacts' },
  { path: '/costs', name: 'Costs' },
  { path: '/memory', name: 'Memory' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/org', name: 'Organization' },
  { path: '/playbooks', name: 'Playbooks' },
  { path: '/plugins', name: 'Plugins' },
  { path: '/recipes', name: 'Recipes' },
  { path: '/search', name: 'Search' },
  { path: '/sessions', name: 'Sessions' },
  { path: '/settings', name: 'Settings' },
  { path: '/skills', name: 'Skills' },
  { path: '/webhooks', name: 'Webhooks' },
];

test.describe('Navigation Pages Load', () => {
  for (const { path: pagePath, name } of pages) {
    test(`${name} page loads without errors`, async ({ authenticatedPage: page }) => {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Should not show 404 or crash
      await expect(page.locator('body')).not.toContainText('Page not found');
      await expect(page.locator('body')).not.toContainText('Something went wrong');

      // Should not redirect to login (auth is valid)
      await expect(page.url()).not.toContain('/login');

      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/03-${name.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    });
  }
});
