import { defineConfig, devices } from '@playwright/test';

/**
 * Real e2e coverage against the actual running app — no dev-tool mocking of the
 * app itself (individual tests still stub specific network calls with page.route()
 * where useful; see playwright/helpers.ts).
 *
 * Prerequisites (not auto-started here — see the two paragraphs below):
 *   1. Play4CashApi running with ENABLE_FAKE_LOGIN=true NODE_ENV=development
 *      (`npm run start:dev` in ../Play4CashApi).
 *   2. Play4CashGateway running the same way (`npm run start:dev` in
 *      ../Play4CashGateway), pointed at the API above via DOWNSTREAM_URL.
 *   3. This repo's VITE_DEV_PROXY_TARGET pointed at the Gateway (see .env.example).
 *
 * The API/Gateway are deliberately NOT wired into `webServer` below: they're
 * separate repos with their own env/DB requirements, and auto-orchestrating
 * three services from one config is more fragile than it's worth. The PWA's own
 * dev server IS auto-started (or reused if you already have it running).
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Chromium is the only browser verified against this app's Ionic/Stencil
    // web components so far. Add firefox/webkit back once someone's confirmed
    // the shadow-DOM / segment-button behavior there too.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
