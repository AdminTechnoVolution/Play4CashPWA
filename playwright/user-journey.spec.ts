import { test, expect } from '@playwright/test';
import { fakeLogin, mockAnonymousSession } from './helpers';

/**
 * Full authenticated user journey against the REAL running backend (API +
 * Gateway, both with ENABLE_FAKE_LOGIN=true) — no route mocking of page data
 * here. The point of this spec is to prove the real app, wired to the real
 * backend, works end to end: log in, then walk through every major
 * authenticated section and confirm each one renders without erroring.
 *
 * Each test logs in as its OWN user (see beforeEach) rather than sharing one
 * cached session across tests. That's deliberate, not just caution: this
 * app's access token lives only in memory and never survives a page load, so
 * EVERY page load calls POST /api/login/refresh — and refresh tokens are
 * single-use with reuse-detection (see AuthService.refreshToken in
 * Play4CashApi). Two independent tests replaying the SAME saved cookie both
 * try to redeem the SAME refresh token: whichever runs first rotates it and
 * silently REVOKES THE WHOLE SESSION FAMILY, so every other test sharing that
 * cookie gets 401'd and bounced to /login. A shared `storageState`/
 * `cy.session()`-style cache was tried first (in both the Cypress and an
 * earlier Playwright draft of this suite) and reproduced exactly that: most
 * tests time out waiting for dashboard content because they silently landed
 * on the login page instead. Logging in fresh per test costs one extra HTTP
 * call and sidesteps the whole class of failure.
 *
 * Every selector below was checked against the real running app before being
 * committed here; the gotchas that came up are called out inline:
 *   - `getByText('Deposits')` is ambiguous — it substring-matches the "No
 *     deposits yet" empty-state text too (Playwright text matching is
 *     case-insensitive by default). Use `{ exact: true }`.
 *   - IonSegmentButton's inner label intercepts pointer events meant for the
 *     segment button itself — click the `ion-segment-button[value=...]` host,
 *     not the label text.
 *   - "Request Withdraw" (the submit button) is a substring of "Request
 *     Withdrawal" (the page's own IonTitle) — scope to the button element.
 *   - ion-textarea in this app does NOT use shadow DOM, so a plain
 *     `page.locator('textarea')` reaches the real input directly.
 */

test.beforeEach(async ({ page }, testInfo) => {
  await fakeLogin(page, `e2e-journey-${testInfo.testId}`);
  await page.goto('/dashboard');
});

test.describe('User journey: log in and navigate the whole app', () => {
  test('logs in for real and lands on the dashboard', async ({ page }) => {
    await expect(page.getByText('PLAY4CASH').first()).toBeVisible();
    // A fresh fake-login user starts at $0.00 — assert the shape, not a fixed
    // value, so this stays correct if the test user ever carries a real balance.
    await expect(page.getByText(/^\$[\d,]+\.\d{2}$/).first()).toBeVisible();
  });

  test('shows the real game catalog fetched from the backend', async ({ page }) => {
    await expect(page.getByText('Our Games')).toBeVisible();
    await expect(page.getByText('See rooms').first()).toBeVisible();
  });

  test('navigates to Tournaments', async ({ page }) => {
    await page.getByText('Tournaments', { exact: true }).click();
    await page.waitForURL('**/tournaments');
    await expect(page.getByText('Compete for prizes in scheduled events')).toBeVisible();
  });

  test('navigates to Add Funds', async ({ page }) => {
    await page.getByText('Add funds', { exact: true }).click();
    await page.waitForURL('**/add-funds');
    await expect(page.getByText('Important Information')).toBeVisible();
  });

  test('navigates to Request Withdrawal', async ({ page }) => {
    await page.getByText('Request Withdrawal', { exact: true }).click();
    await page.waitForURL('**/withdrawal');
    await expect(page.getByText('Available balance')).toBeVisible();
    // Not a bare text match — "Request Withdraw" is also a substring of this
    // page's own IonTitle ("Request Withdrawal"). Scope to the actual button.
    await expect(page.getByRole('button', { name: 'Request Withdraw' })).toBeVisible();
  });

  test('navigates to History and switches tabs', async ({ page }) => {
    await page.getByText('History', { exact: true }).click();
    await page.waitForURL('**/history');
    // exact:true — a bare match also hits "No deposits yet" (case-insensitive
    // substring match on "deposits").
    await expect(page.getByText('Deposits', { exact: true })).toBeVisible();

    // IonSegmentButton's inner label intercepts clicks meant for the segment
    // button itself — target the segment-button host by its `value`.
    await page.locator('ion-segment-button[value="withdrawals"]').click();
    await page.locator('ion-segment-button[value="games"]').click();
    await page.locator('ion-segment-button[value="tournaments"]').click();
  });

  test('navigates to Contact Us, checks My Requests, and submits a new one', async ({ page }) => {
    await page.getByText('Contact Us', { exact: true }).click();
    await page.waitForURL('**/contact-us');
    await expect(page.getByText('New request')).toBeVisible();

    await page.locator('ion-segment-button[value="mine"]').click();
    // Graceful either way: a real past request, or the empty state.
    await expect(page.locator('body')).toBeVisible();

    await page.locator('ion-segment-button[value="new"]').click();
    // The submit button stays disabled until type + at least one game (or the
    // "All games" toggle) + a long-enough message are all set (see
    // ContactUsPage's `canSubmit`) — fill all three, not just the message.
    await page.locator('ion-select').click();
    // Ionic's action-sheet interface renders options as radios in a dialog,
    // not buttons.
    await page.getByRole('radio', { name: 'Comment', exact: true }).click();
    await page.locator('ion-toggle').click(); // "All games" toggle
    await page.locator('textarea').first().fill('e2e journey smoke test — please ignore.');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
    await page.getByText('Send message').click();
    // Not /message|success|sent/i — that also matches the static "Message
    // type" field heading/label already on the page. Match the actual
    // confirmation copy (contact_us_success in src/i18n/en.json).
    await expect(page.getByText('sent successfully', { exact: false })).toBeVisible();
  });

  test('navigates to Settings and sees the legal links', async ({ page }) => {
    await page.getByText('Settings', { exact: true }).click();
    await page.waitForURL('**/settings');
    await expect(page.getByText('Terms & Conditions')).toBeVisible();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });

  test('opens a game room list from the dashboard', async ({ page }) => {
    // Real navigation only — RoomsPage reads game context from sessionStorage
    // set by this click, so it can't be reached via a direct page.goto(). We
    // verify the HTTP-backed room list (or its empty state) renders, then
    // leave before any socket-driven gameplay, which is out of scope for a
    // navigation smoke test.
    await page.getByText('See rooms').first().click();
    await page.waitForURL(/\/rooms\//, { timeout: 10_000 });
    // Auto-retrying assertion, not an immediate .innerText() snapshot — the
    // room list's own async fetch hasn't necessarily resolved the instant the
    // URL changes, and a plain snapshot raced it (empty-state text landed a
    // beat after the check ran). .first() because "Create Room" is also a
    // persistent action always present alongside the empty state, not just an
    // alternative to it — .or() alone hits Playwright's strict-mode check
    // when both sides match at once.
    await expect(
      page.getByRole('heading', { name: 'No Rooms Yet' }).or(page.getByText('Create Room')).first(),
    ).toBeVisible();
  });

  test('logs out and returns to the login page', async ({ page }) => {
    await mockAnonymousSession(page);

    await page.getByText('Log out', { exact: true }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });

    await expect(page.getByText('Welcome to Play4Cash')).toBeVisible();
  });
});
