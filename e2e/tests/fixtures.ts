import { test as base, Page } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';

export const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

interface AuthCredentials {
  apiKey: string;
  companyId: string;
  userId: string;
}

// These credentials are from the test account registered for E2E testing.
// If these expire or the account is deleted, re-register and update.
const HARDCODED_CREDENTIALS: AuthCredentials = {
  apiKey: 'comp_live_fc57fa837b1eac509f3f46add11058c4de63f055c5d57931534180a6698477ac',
  companyId: 'd492ce05-e901-45bd-93e0-bb993676c03b',
  userId: 'b2eaa0db-7a74-472e-818c-a0cd4c100083',
};

async function getOrCreateTestUser(): Promise<AuthCredentials> {
  // First verify the hardcoded credentials still work
  try {
    const result = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${HARDCODED_CREDENTIALS.apiKey}" http://localhost:3000/api/issues`,
      { timeout: 10000 }
    ).toString().trim();

    if (result === '200') {
      return HARDCODED_CREDENTIALS;
    }
  } catch {
    // Fall through to registration
  }

  // Try to register a new account
  try {
    const result = execSync(
      `curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test2@maestro.local","password":"Password123!","name":"Test User 2","companyName":"Test Corp 2"}'`,
      { timeout: 10000 }
    ).toString();

    const data = JSON.parse(result);
    if (data.apiKey) {
      return { apiKey: data.apiKey, companyId: data.companyId, userId: data.userId };
    }
  } catch {
    // Ignore
  }

  throw new Error('Cannot get test credentials - please check the hardcoded credentials or re-register');
}

export async function injectAuth(page: Page): Promise<void> {
  const creds = await getOrCreateTestUser();
  await page.goto('http://localhost:5173/login');
  await page.evaluate((c) => {
    localStorage.setItem('apiKey', c.apiKey);
    localStorage.setItem('companyId', c.companyId);
    localStorage.setItem('userId', c.userId);
  }, creds);
}

type MaestroFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<MaestroFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await injectAuth(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
