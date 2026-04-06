import { Page } from '@playwright/test';

const TEST_EMAIL = 'test@maestro.local';
const TEST_PASSWORD = 'Password123!';
const TEST_NAME = 'Test User';
const TEST_COMPANY = 'Test Corp';

export interface AuthCredentials {
  apiKey: string;
  companyId: string;
  userId: string;
}

/**
 * Register a new test user via API, or login if already exists.
 * Returns credentials for localStorage injection.
 */
export async function getOrCreateTestUser(): Promise<AuthCredentials> {
  // Try to register first
  const registerRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
      companyName: TEST_COMPANY,
    }),
  });

  if (registerRes.ok) {
    const data = await registerRes.json();
    return {
      apiKey: data.apiKey,
      companyId: data.companyId,
      userId: data.userId,
    };
  }

  // If registration failed (user exists), login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (loginRes.ok) {
    const data = await loginRes.json();
    return {
      apiKey: data.apiKey,
      companyId: data.companyId,
      userId: data.userId,
    };
  }

  throw new Error('Failed to get test user credentials');
}

/**
 * Inject auth credentials into localStorage to bypass login UI.
 */
export async function injectAuth(page: Page, credentials: AuthCredentials): Promise<void> {
  await page.goto('http://localhost:5173/login');
  await page.evaluate((creds) => {
    localStorage.setItem('apiKey', creds.apiKey);
    localStorage.setItem('companyId', creds.companyId);
    localStorage.setItem('userId', creds.userId);
  }, credentials);
}

/**
 * Full login flow through UI.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"], input[name="email"], #email', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"], #password', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:5173/', { timeout: 10000 });
}

export { TEST_EMAIL, TEST_PASSWORD, TEST_NAME, TEST_COMPANY };
