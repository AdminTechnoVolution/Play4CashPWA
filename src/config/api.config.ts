import { getRuntimeEnv } from './runtimeEnv';

// Runtime API origin. In dev, leave it empty when using the local proxy.
export const BASE_URL =
  getRuntimeEnv('VITE_API_URL') ||
  (import.meta.env.DEV ? '' : 'https://p4c-api.techno-volution.com');

export const SOCKET_TIMEOUT_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 180_000;
export const TOKEN_LEEWAY_S = 60;
export const MAX_RETRIES = 2;
