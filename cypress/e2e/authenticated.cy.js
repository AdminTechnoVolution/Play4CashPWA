// Real authenticated e2e coverage — requires the backend's test-only login bypass
// to be enabled (ENABLE_FAKE_LOGIN=true on both Play4CashApi and Play4CashGateway,
// non-production NODE_ENV on both) and the PWA dev server to proxy /api to them
// (VITE_DEV_PROXY_TARGET). See cypress/support/commands.ts for how cy.fakeLogin()
// gets a genuine session — same JWT/cookie machinery as a real Google login, just
// without automating Google's cross-origin sign-in iframe (which Cypress can't
// drive anyway). Page-data calls (account/games/room-stats/wallets) are stubbed
// via cy.mockDashboardData() so assertions don't depend on live DB seed state.

describe('Authenticated: Dashboard', () => {
  beforeEach(() => {
    // Wide enough to trip Ionic's IonSplitPane 'lg' breakpoint (992px), so the
    // side menu (nav links, logout) renders inline instead of behind a toggle.
    cy.viewport(1280, 900);
    cy.mockDashboardData();
    cy.fakeLogin();
    cy.visit('/dashboard');
    cy.wait('@userAccount');
  });

  it('loads a real authenticated session and renders the dashboard', () => {
    cy.contains('PLAY4CASH').should('be.visible');
    cy.contains('$250.00').should('be.visible');
  });

  it('shows the side navigation to the other authenticated pages', () => {
    cy.contains('Settings').should('be.visible');
    cy.contains('History').should('be.visible');
    cy.contains('Add funds').should('be.visible');
    cy.contains('Request Withdrawal').should('be.visible');
  });

  it('navigates to Settings from the side menu', () => {
    cy.contains('Settings').click();
    cy.location('pathname').should('eq', '/settings');
    cy.contains('Settings').should('be.visible');
  });

  it('logs out and returns to the login page', () => {
    cy.intercept('POST', '**/api/logout', { statusCode: 200, body: { success: true, messages: [], data: null } }).as('logout');
    cy.mockAnonymousSession();

    cy.contains('Log out').click();

    cy.wait('@logout');
    cy.location('pathname').should('eq', '/login');
    cy.contains('Welcome to Play4Cash').should('be.visible');
  });
});

describe('Authenticated: Settings page', () => {
  beforeEach(() => {
    cy.fakeLogin();
    cy.mockDashboardData();
    cy.intercept('GET', '**/api/wallets', { statusCode: 200, body: { success: true, data: [], messages: [] } }).as('wallets');
    cy.visit('/settings');
    cy.wait('@userAccount');
  });

  it('renders the settings page for a real authenticated session', () => {
    cy.contains('Settings').should('be.visible');
  });

  it('links to the legal pages', () => {
    cy.contains('Terms & Conditions').should('be.visible');
    cy.contains('Privacy Policy').should('be.visible');
  });
});
