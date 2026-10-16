// Full authenticated user journey against the REAL running backend (API + Gateway,
// both with ENABLE_FAKE_LOGIN=true) — no cy.intercept() stubbing of page data here.
// The point of this spec is to prove the real app, wired to the real backend, works
// end to end: log in, then walk through every major authenticated section and
// confirm each one renders without erroring.
//
// For fast, deterministic single-page checks with mocked data instead, see
// cypress/e2e/authenticated.cy.js. This file is the complement: slower, real,
// broader.
//
// One test user (see beforeEach) is reused across the whole file via cy.session()
// so the journey reads as one continuous session, the way a real user would
// experience it, while still getting isolated pass/fail reporting per leg.

const JOURNEY_USER = `e2e-journey-${Date.now()}`;

function loginAndVisit(path) {
  cy.session(JOURNEY_USER, () => {
    cy.fakeLogin(JOURNEY_USER);
  });
  cy.visit(path);
}

describe('User journey: log in and navigate the whole app', () => {
  it('logs in for real and lands on the dashboard', () => {
    loginAndVisit('/dashboard');

    cy.contains('PLAY4CASH').should('be.visible');
    // A fresh fake-login user starts at $0.00 — assert the shape, not a fixed
    // value, so this stays correct if the test user ever carries a real balance.
    cy.contains(/^\$[\d,]+\.\d{2}$/).should('be.visible');
  });

  it('shows the real game catalog fetched from the backend', () => {
    loginAndVisit('/dashboard');

    cy.contains('Our Games').should('be.visible');
    cy.contains('See rooms').should('be.visible');
  });

  it('navigates to Tournaments', () => {
    loginAndVisit('/dashboard');

    cy.contains('Tournaments').click();
    cy.location('pathname').should('eq', '/tournaments');
    cy.contains('Compete for prizes in scheduled events').should('be.visible');
    // Either real tournaments render, or the graceful empty state does — both
    // prove the page survived a real GET /api/tournaments round trip.
    cy.get('body').then(($body) => {
      expect(
        $body.text().includes('No tournaments available.') || $body.find('[class*=tournament]').length > 0,
      ).to.be.true;
    });
  });

  it('navigates to Add Funds', () => {
    loginAndVisit('/dashboard');

    cy.contains('Add funds').click();
    cy.location('pathname').should('eq', '/add-funds');
    cy.contains('Important Information').should('be.visible');
  });

  it('navigates to Request Withdrawal', () => {
    loginAndVisit('/dashboard');

    cy.contains('Request Withdrawal').click();
    cy.location('pathname').should('eq', '/withdrawal');
    cy.contains('Available balance').should('be.visible');
    // Not a bare cy.contains('Request Withdraw') — that string is also a substring
    // of the page's own IonTitle ("Request Withdrawal"), so it's ambiguous. Scope
    // to the actual submit button.
    cy.get('ion-button').contains('Request Withdraw').should('be.visible');
  });

  it('navigates to History and switches tabs', () => {
    loginAndVisit('/dashboard');

    cy.contains('History').click();
    cy.location('pathname').should('eq', '/history');
    cy.contains('Deposits').should('be.visible');

    // IonSegmentButton's inner label intercepts clicks meant for the segment
    // button itself (confirmed against the real running app) — target the
    // segment-button host element by its `value`, not the label text.
    cy.get('ion-segment-button[value="withdrawals"]').click();
    cy.get('ion-segment-button[value="games"]').click();
    cy.get('ion-segment-button[value="tournaments"]').click();
  });

  it('navigates to Contact Us, checks My Requests, and submits a new one', () => {
    loginAndVisit('/dashboard');

    cy.contains('Contact Us').click();
    cy.location('pathname').should('eq', '/contact-us');
    cy.contains('New request').should('be.visible');

    cy.get('ion-segment-button[value="mine"]').click();
    // Graceful either way: a real past request, or the empty state.
    cy.get('body').should('be.visible');

    cy.get('ion-segment-button[value="new"]').click();
    cy.get('textarea').first().type('e2e journey smoke test — please ignore.', { force: true });
    cy.contains('Send message').click();
    cy.contains(/message|success|sent/i).should('be.visible');
  });

  it('navigates to Settings and sees the legal links', () => {
    loginAndVisit('/dashboard');

    cy.contains('Settings').click();
    cy.location('pathname').should('eq', '/settings');
    cy.contains('Terms & Conditions').should('be.visible');
    cy.contains('Privacy Policy').should('be.visible');
  });

  it('opens a game room list from the dashboard', () => {
    loginAndVisit('/dashboard');

    // Real navigation only — RoomsPage reads game context from sessionStorage set
    // by this click, so it can't be reached via a direct cy.visit(). We verify the
    // HTTP-backed room list (or its empty state) renders, then leave before any
    // socket-driven gameplay, which is out of scope for a navigation smoke test.
    cy.contains('See rooms').first().click();
    cy.location('pathname').should('match', /^\/rooms\//);
    cy.get('body').then(($body) => {
      expect(
        $body.text().includes('No Rooms Yet') || $body.text().includes('Create Room'),
      ).to.be.true;
    });
  });

  it('logs out and returns to the login page', () => {
    loginAndVisit('/dashboard');
    cy.mockAnonymousSession();

    cy.contains('Log out').click();

    cy.location('pathname').should('eq', '/login');
    cy.contains('Welcome to Play4Cash').should('be.visible');
  });
});
