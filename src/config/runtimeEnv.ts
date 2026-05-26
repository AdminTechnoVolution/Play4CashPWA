/** Keys injected at runtime via `/env-config.js` (Azure App Service Application Settings). */
export type RuntimeEnvKey = 'VITE_API_URL' | 'VITE_GOOGLE_CLIENT_ID' | 'VITE_VAPID_PUBLIC_KEY';

declare global {
  interface Window {
    __P4C_ENV__?: Partial<Record<RuntimeEnvKey, string>>;
  }
}

/**
 * Reads a VITE_* value from runtime config (App Service) with build-time fallback (.env / CI).
 * In production builds, import.meta.env VITE_* are intentionally empty — only
 * window.__P4C_ENV__ (from /env-config.js) supplies values.
 */
export function getRuntimeEnv(key: RuntimeEnvKey): string | undefined {
  const runtime = typeof window !== 'undefined' ? window.__P4C_ENV__?.[key] : undefined;
  if (runtime !== undefined && runtime !== '') {
    return runtime;
  }
  if (import.meta.env.DEV) {
    const built = import.meta.env[key];
    return typeof built === 'string' && built !== '' ? built : undefined;
  }
  return undefined;
}

export function getGoogleClientId(): string {
  return getRuntimeEnv('VITE_GOOGLE_CLIENT_ID') ?? '';
}
