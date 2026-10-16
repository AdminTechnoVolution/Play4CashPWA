import { defineConfig, devices } from '@playwright/test';

// Default CI suite exercises the real PWA with explicit browser API fixtures.
// P4C_E2E_MODE=real keeps the integration journey against separately running API/Gateway.
const mode = process.env.P4C_E2E_MODE || 'mock';
if (!['mock', 'real'].includes(mode)) throw new Error('P4C_E2E_MODE must be mock or real');
const target = process.env.P4C_E2E_GATEWAY_URL || '';
if (mode === 'real' && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(target)) {
  throw new Error('Real E2E requires P4C_E2E_GATEWAY_URL pointing to your dedicated localhost test gateway. Never use production.');
}
export default defineConfig({
  testDir: './playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000 --strictPort',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_API_URL: '',
      VITE_GOOGLE_CLIENT_ID: '',
      VITE_RELIABLE_COMMANDS: 'true',
      VITE_DEV_PROXY_TARGET: mode === 'real' ? target : '',
    },
  },
});
