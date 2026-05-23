import { getRuntimeEnv } from './runtimeEnv';

// VITE_API_URL: local `.env` at build/dev time; Azure App Service Application Settings
// at runtime (injected via `/env-config.js` before the app bundle loads).
// In dev with `VITE_DEV_PROXY_TARGET` set, leave VITE_API_URL empty so the SPA
// hits the Vite proxy on its own origin (`/api`, `/socket.io`) and the httpOnly
// refresh cookie behaves as same-origin (no SameSite=None needed).
// CORS on the API must list this app's origin with credentials for the cookie path.
export const BASE_URL =
  getRuntimeEnv('VITE_API_URL') ||
  (import.meta.env.DEV ? '' : 'https://p4c-api.techno-volution.com');

export const SOCKET_TIMEOUT_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 180_000;
export const TOKEN_LEEWAY_S = 60;
export const MAX_RETRIES = 2;
