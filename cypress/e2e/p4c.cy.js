// Real e2e coverage for the parts of Play4Cash that are reachable without a live
// backend or a real Google OAuth flow (Cypress can't drive Google's cross-origin
// sign-in iframe): the login screen, the public legal pages, and the anonymous-user
// redirect behavior. `loadSession()` always calls POST /api/login/refresh on mount
// (see cypress/support/commands.ts), so every test that loads the app stubs that
// via `cy.mockAnonymousSession()`.

describe('Login page', () => {
  beforeEach(() => {
    cy.mockAnonymousSession(42);
    cy.visit('/login');
    cy.wait('@refresh');
  });

  it('shows the welcome card', () => {
    cy.contains('Welcome to Play4Cash').should('be.visible');
    cy.contains('ACCESS YOUR SECURE DASHBOARD').should('be.visible');
    cy.contains('Bet real money ● Make real money').should('be.visible');
  });

  it('shows the community stats once the public-stats request resolves', () => {
    cy.wait('@publicStats');
    cy.contains('Our community').should('be.visible');
    cy.contains('Registered players on Play4Cash').should('be.visible');
    cy.contains('42').should('be.visible');
  });

  it('links to the Terms and Privacy Policy pages', () => {
    cy.contains('a', 'Terms').should('have.attr', 'href', '/terms');
    cy.contains('a', 'Privacy Policy').should('have.attr', 'href', '/privacy');
  });

  it('navigates to the Terms page from the compliance link', () => {
    cy.contains('a', 'Terms').click();
    cy.location('pathname').should('eq', '/terms');
    cy.contains('Terms of service').should('be.visible');
  });
});

describe('Legal pages (public, no auth or API required)', () => {
  it('renders the Terms of Service page', () => {
    cy.visit('/terms');
    cy.contains('Terms of service').should('be.visible');
    cy.contains('Last updated: March 2026').should('be.visible');
  });

  it('renders the Privacy Policy page', () => {
    cy.visit('/privacy');
    cy.contains('Privacy policy').should('be.visible');
  });

  it('renders the Personal Data Processing page', () => {
    cy.visit('/data-treatment');
    cy.contains('Personal data processing').should('be.visible');
  });

  it('the back button returns to the previous page', () => {
    cy.mockAnonymousSession();
    cy.visit('/login');
    cy.wait('@refresh');
    cy.contains('a', 'Privacy Policy').click();
    cy.location('pathname').should('eq', '/privacy');

    cy.get('ion-buttons[slot="start"] ion-button').first().click();
    cy.location('pathname').should('eq', '/login');
  });
});

describe('Unauthenticated redirect behavior', () => {
  beforeEach(() => {
    cy.mockAnonymousSession();
  });

  it('redirects an anonymous visitor from "/" to "/login"', () => {
    cy.visit('/');
    cy.wait('@refresh');
    cy.location('pathname').should('eq', '/login');
    cy.contains('Welcome to Play4Cash').should('be.visible');
  });

  it('redirects an anonymous visitor away from a protected route', () => {
    cy.visit('/dashboard');
    cy.wait('@refresh');
    cy.location('pathname').should('eq', '/login');
  });

  it('redirects an unknown path to "/login"', () => {
    cy.visit('/this-route-does-not-exist');
    cy.wait('@refresh');
    cy.location('pathname').should('eq', '/login');
  });
});
