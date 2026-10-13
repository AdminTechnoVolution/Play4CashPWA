/// <reference types="cypress" />

// The app is a real SPA: every mount calls `loadSession()`, which — since the access
// token lives only in memory and never survives a fresh page load — always calls
// `POST /api/login/refresh` before it knows whether anyone is logged in. Without a
// real backend running, that request would otherwise hang/error unpredictably, so
// every e2e test that loads the app needs this stubbed to get a deterministic,
// logged-out `authHydrated: true` state.
Cypress.Commands.add('mockAnonymousSession', (registeredUsers = 42) => {
  cy.intercept('POST', '**/api/login/refresh', {
    statusCode: 401,
    body: { success: false, messages: ['error_session_expired'] },
  }).as('refresh');

  cy.intercept('GET', '**/api/user/public/stats', {
    statusCode: 200,
    body: { success: true, data: { registeredUsers }, messages: [] },
  }).as('publicStats');
});

// Real authentication, no shortcuts in the app bundle: this calls the backend's
// test-only POST /api/login/fake (see Play4CashApi's AuthController.fakeLogin),
// which requires ENABLE_FAKE_LOGIN=true on both the API and the Gateway, and is
// hard-blocked whenever NODE_ENV=production on either side.
//
// It works exactly like a real Google login minus the Google part: same JWT
// issuance, same Redis session-family bookkeeping, same httpOnly refresh cookie.
// cy.request() automatically stores that Set-Cookie in the browser's cookie jar,
// so the very next cy.visit() has a real, working session — `loadSession()`'s
// POST /api/login/refresh succeeds for real and mints a real in-memory access
// token, identical to what a genuine login produces. No test-only code path
// exists anywhere in the shipped app for this — it's 100% a backend feature,
// invoked directly from the test.
//
// Requires the PWA's dev server to proxy /api to a Gateway/API that both have
// ENABLE_FAKE_LOGIN=true (see .env.example: VITE_DEV_PROXY_TARGET).
Cypress.Commands.add('fakeLogin', (localPart) => {
  const email = `${localPart || `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`}@play4cash.test`;
  return cy
    .request('POST', '/api/login/fake', { email })
    .its('status')
    .should('eq', 200)
    .then(() => email);
});

// Stubs the REST calls DashboardPage fires on mount (account/games/room-stats/
// my-tournaments) so dashboard tests render deterministically regardless of live
// DB seed data. Auth itself is still real (see cy.fakeLogin) — only the
// page-data calls are mocked here.
Cypress.Commands.add('mockDashboardData', (accountOverrides = {}) => {
  const account = {
    _id: 'e2e-user-1',
    email: 'e2e-alice@play4cash.test',
    username: 'e2e_alice',
    balance: 250,
    wallet_address: { wallet: '', coin: 'USDT', network: '' },
    ...accountOverrides,
  };

  cy.intercept('GET', '**/api/user/account', {
    statusCode: 200,
    body: { success: true, data: account, messages: [] },
  }).as('userAccount');

  cy.intercept('GET', '**/api/games', {
    statusCode: 200,
    body: { success: true, data: [], messages: [] },
  }).as('games');

  cy.intercept('GET', '**/api/rooms/stats', {
    statusCode: 200,
    body: { success: true, data: { playersOnline: 0, activeGames: 0, totalBetAmount: 0 }, messages: [] },
  }).as('roomStats');

  cy.intercept('GET', '**/api/tournaments/mine', {
    statusCode: 200,
    body: { success: true, data: [], messages: [] },
  }).as('myTournaments');

  cy.intercept('GET', '**/api/wallets', {
    statusCode: 200,
    body: { success: true, data: [], messages: [] },
  }).as('wallets');

  return cy.wrap(account).as('account');
});

declare global {
  namespace Cypress {
    interface Chainable {
      /** Stubs the session-refresh + public-stats calls the login page always makes. */
      mockAnonymousSession(registeredUsers?: number): Chainable<void>;
      /** Real login via the backend's test-only bypass. Resolves to the email used. */
      fakeLogin(localPart?: string): Chainable<string>;
      /** Stubs DashboardPage's mount-time REST calls with deterministic data. */
      mockDashboardData(accountOverrides?: Record<string, unknown>): Chainable<unknown>;
    }
  }
}

export {};
