// Build-time env via Vite — set VITE_ENV=prod in production
const isProd = import.meta.env.VITE_ENV === 'prod';

export const BASE_URL = isProd
  ? 'https://p4c-agazhsdng5fuexaq.mexicocentral-01.azurewebsites.net'
  : 'https://p4c-api.techno-volution.com';

export const SOCKET_TIMEOUT_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 180_000;
export const TOKEN_LEEWAY_S = 60;
export const MAX_RETRIES = 2;
