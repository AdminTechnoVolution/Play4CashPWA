// VITE_API_URL must be set in .env — e.g. https://p4c-api.techno-volution.com
// Falls back to prod server so the app always works out of the box.
export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  'https://p4c-api.techno-volution.com';

export const SOCKET_TIMEOUT_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 180_000;
export const TOKEN_LEEWAY_S = 60;
export const MAX_RETRIES = 2;
