import type { Page } from '@playwright/test';

/**
 * Real login, no shortcuts in the app bundle: calls the backend's test-only
 * POST /api/login/fake (see Play4CashApi's AuthController.fakeLogin), which
 * requires ENABLE_FAKE_LOGIN=true on both the API and the Gateway, and is
 * hard-blocked whenever NODE_ENV=production on either side.
 *
 * It works exactly like a real Google login minus the Google part: same JWT
 * issuance, same Redis session-family bookkeeping, same httpOnly refresh
 * cookie. `page.request.post()` shares the browser context's cookie jar, so
 * the very next `page.goto()` has a real, working session — `loadSession()`'s
 * POST /api/login/refresh succeeds for real and mints a real in-memory access
 * token, identical to what a genuine login produces. No test-only code path
 * exists anywhere in the shipped app for this — it's 100% a backend feature,
 * invoked directly from the test.
 */
export async function fakeLogin(page: Page, localPart?: string): Promise<string> {
  const email = `${localPart || `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`}@play4cash.test`;
  const res = await page.request.post('/api/login/fake', { data: { email } });
  if (res.status() !== 200) {
    throw new Error(`fakeLogin failed: ${res.status()} ${await res.text()}`);
  }
  return email;
}

/**
 * Stubs the session-refresh + public-stats calls the login page always makes
 * on mount (see loadSession() in src/store/authStore.ts — the access token is
 * in-memory only, so every fresh page load calls POST /api/login/refresh
 * before it knows whether anyone is logged in). Use this for tests that need
 * a deterministic *anonymous* state, e.g. right after logging out.
 */
export async function mockAnonymousSession(page: Page, registeredUsers = 42): Promise<void> {
  await page.route('**/api/login/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, messages: ['error_session_expired'] }),
    }),
  );
  await page.route('**/api/user/public/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { registeredUsers }, messages: [] }),
    }),
  );
}
