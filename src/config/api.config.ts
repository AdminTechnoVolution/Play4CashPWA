import { getRuntimeEnv } from './runtimeEnv';

// Runtime API origin. In dev, leave it empty when using the local proxy.
// In production, `/` keeps the browser same-origin when the PWA server proxies /api.
export const BASE_URL =
  getRuntimeEnv('VITE_API_URL') ||
  (import.meta.env.DEV ? '' : '/');

export function buildSocketUrl(namespace: string): string {
  const rawBase = BASE_URL.trim();
  if (!rawBase || rawBase === '/' || rawBase.startsWith('/')) {
    return namespace;
  }

  try {
    return `${new URL(rawBase).origin}${namespace}`;
  } catch {
    return namespace;
  }
}

export const SOCKET_TIMEOUT_MS = 20_000;
export const REQUEST_TIMEOUT_MS = 180_000;
export const TOKEN_LEEWAY_S = 60;
export const MAX_RETRIES = 2;
