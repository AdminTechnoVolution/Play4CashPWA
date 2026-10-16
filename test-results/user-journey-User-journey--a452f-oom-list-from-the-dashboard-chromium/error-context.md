# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> User journey: log in and navigate the whole app >> opens a game room list from the dashboard
- Location: playwright/user-journey.spec.ts:127:3

# Error details

```
Error: fakeLogin failed: 429 {"success":false,"messages":["Too many requests. Please try again later."],"data":null}
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * Real login, no shortcuts in the app bundle: calls the backend's test-only
  5  |  * POST /api/login/fake (see Play4CashApi's AuthController.fakeLogin), which
  6  |  * requires ENABLE_FAKE_LOGIN=true on both the API and the Gateway, and is
  7  |  * hard-blocked whenever NODE_ENV=production on either side.
  8  |  *
  9  |  * It works exactly like a real Google login minus the Google part: same JWT
  10 |  * issuance, same Redis session-family bookkeeping, same httpOnly refresh
  11 |  * cookie. `page.request.post()` shares the browser context's cookie jar, so
  12 |  * the very next `page.goto()` has a real, working session — `loadSession()`'s
  13 |  * POST /api/login/refresh succeeds for real and mints a real in-memory access
  14 |  * token, identical to what a genuine login produces. No test-only code path
  15 |  * exists anywhere in the shipped app for this — it's 100% a backend feature,
  16 |  * invoked directly from the test.
  17 |  */
  18 | export async function fakeLogin(page: Page, localPart?: string): Promise<string> {
  19 |   const email = `${localPart || `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`}@play4cash.test`;
  20 |   const res = await page.request.post('/api/login/fake', { data: { email } });
  21 |   if (res.status() !== 200) {
> 22 |     throw new Error(`fakeLogin failed: ${res.status()} ${await res.text()}`);
     |           ^ Error: fakeLogin failed: 429 {"success":false,"messages":["Too many requests. Please try again later."],"data":null}
  23 |   }
  24 |   return email;
  25 | }
  26 | 
  27 | /**
  28 |  * Stubs the session-refresh + public-stats calls the login page always makes
  29 |  * on mount (see loadSession() in src/store/authStore.ts — the access token is
  30 |  * in-memory only, so every fresh page load calls POST /api/login/refresh
  31 |  * before it knows whether anyone is logged in). Use this for tests that need
  32 |  * a deterministic *anonymous* state, e.g. right after logging out.
  33 |  */
  34 | export async function mockAnonymousSession(page: Page, registeredUsers = 42): Promise<void> {
  35 |   await page.route('**/api/login/refresh', (route) =>
  36 |     route.fulfill({
  37 |       status: 401,
  38 |       contentType: 'application/json',
  39 |       body: JSON.stringify({ success: false, messages: ['error_session_expired'] }),
  40 |     }),
  41 |   );
  42 |   await page.route('**/api/user/public/stats', (route) =>
  43 |     route.fulfill({
  44 |       status: 200,
  45 |       contentType: 'application/json',
  46 |       body: JSON.stringify({ success: true, data: { registeredUsers }, messages: [] }),
  47 |     }),
  48 |   );
  49 | }
  50 | 
```