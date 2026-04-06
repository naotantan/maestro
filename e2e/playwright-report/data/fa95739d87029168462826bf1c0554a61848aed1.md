# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 12-content-pages.spec.ts >> Content/Resource Pages >> webhooks page loads
- Location: tests/12-content-pages.spec.ts:68:7

# Error details

```
Error: Cannot get test credentials - please check the hardcoded credentials or re-register
```

# Test source

```ts
  1  | import { test as base, Page } from '@playwright/test';
  2  | import path from 'path';
  3  | import { execSync } from 'child_process';
  4  | 
  5  | export const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
  6  | 
  7  | interface AuthCredentials {
  8  |   apiKey: string;
  9  |   companyId: string;
  10 |   userId: string;
  11 | }
  12 | 
  13 | // These credentials are from the test account registered for E2E testing.
  14 | // If these expire or the account is deleted, re-register and update.
  15 | const HARDCODED_CREDENTIALS: AuthCredentials = {
  16 |   apiKey: 'comp_live_fc57fa837b1eac509f3f46add11058c4de63f055c5d57931534180a6698477ac',
  17 |   companyId: 'd492ce05-e901-45bd-93e0-bb993676c03b',
  18 |   userId: 'b2eaa0db-7a74-472e-818c-a0cd4c100083',
  19 | };
  20 | 
  21 | async function getOrCreateTestUser(): Promise<AuthCredentials> {
  22 |   // First verify the hardcoded credentials still work
  23 |   try {
  24 |     const result = execSync(
  25 |       `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${HARDCODED_CREDENTIALS.apiKey}" http://localhost:3000/api/issues`,
  26 |       { timeout: 10000 }
  27 |     ).toString().trim();
  28 | 
  29 |     if (result === '200') {
  30 |       return HARDCODED_CREDENTIALS;
  31 |     }
  32 |   } catch {
  33 |     // Fall through to registration
  34 |   }
  35 | 
  36 |   // Try to register a new account
  37 |   try {
  38 |     const result = execSync(
  39 |       `curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"test2@maestro.local","password":"Password123!","name":"Test User 2","companyName":"Test Corp 2"}'`,
  40 |       { timeout: 10000 }
  41 |     ).toString();
  42 | 
  43 |     const data = JSON.parse(result);
  44 |     if (data.apiKey) {
  45 |       return { apiKey: data.apiKey, companyId: data.companyId, userId: data.userId };
  46 |     }
  47 |   } catch {
  48 |     // Ignore
  49 |   }
  50 | 
> 51 |   throw new Error('Cannot get test credentials - please check the hardcoded credentials or re-register');
     |         ^ Error: Cannot get test credentials - please check the hardcoded credentials or re-register
  52 | }
  53 | 
  54 | export async function injectAuth(page: Page): Promise<void> {
  55 |   const creds = await getOrCreateTestUser();
  56 |   await page.goto('http://localhost:5173/login');
  57 |   await page.evaluate((c) => {
  58 |     localStorage.setItem('apiKey', c.apiKey);
  59 |     localStorage.setItem('companyId', c.companyId);
  60 |     localStorage.setItem('userId', c.userId);
  61 |   }, creds);
  62 | }
  63 | 
  64 | type MaestroFixtures = {
  65 |   authenticatedPage: Page;
  66 | };
  67 | 
  68 | export const test = base.extend<MaestroFixtures>({
  69 |   authenticatedPage: async ({ page }, use) => {
  70 |     await injectAuth(page);
  71 |     await use(page);
  72 |   },
  73 | });
  74 | 
  75 | export { expect } from '@playwright/test';
  76 | 
```