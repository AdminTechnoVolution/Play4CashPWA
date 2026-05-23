import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleClientId, getRuntimeEnv } from './runtimeEnv';

describe('runtimeEnv', () => {
  afterEach(() => {
    delete window.__P4C_ENV__;
    vi.unstubAllEnvs();
  });

  it('prefers window.__P4C_ENV__ over build-time import.meta.env', () => {
    window.__P4C_ENV__ = { VITE_API_URL: 'https://runtime.example' };
    vi.stubEnv('VITE_API_URL', 'https://build.example');
    expect(getRuntimeEnv('VITE_API_URL')).toBe('https://runtime.example');
  });

  it('falls back to import.meta.env in dev when runtime value is missing', () => {
    if (!import.meta.env.DEV) {
      expect(getGoogleClientId()).toBe('');
      return;
    }
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'build-client-id');
    expect(getGoogleClientId()).toBe('build-client-id');
  });

  it('does not use build-time env in production when runtime is missing', () => {
    if (import.meta.env.DEV) return;
    vi.stubEnv('VITE_API_URL', 'https://build.example');
    expect(getRuntimeEnv('VITE_API_URL')).toBeUndefined();
  });

  it('ignores empty runtime strings in dev', () => {
    if (!import.meta.env.DEV) return;
    window.__P4C_ENV__ = { VITE_API_URL: '' };
    vi.stubEnv('VITE_API_URL', 'https://build.example');
    expect(getRuntimeEnv('VITE_API_URL')).toBe('https://build.example');
  });
});
