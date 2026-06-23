import { AxiosHeaders } from 'axios';
import { describe, expect, it, beforeEach } from 'vitest';
import { apiClient } from './ApiClient';
import { clearTokens, saveTokens } from '../auth/AuthSessionStore';

function getRequestInterceptor(): (config: any) => any {
  const handlers = (apiClient.interceptors.request as unknown as { handlers: Array<{ fulfilled?: (config: any) => any }> }).handlers;
  const handler = handlers.find((entry) => typeof entry?.fulfilled === 'function');
  if (!handler?.fulfilled) {
    throw new Error('request interceptor not registered');
  }
  return handler.fulfilled;
}

describe('ApiClient', () => {
  beforeEach(() => {
    clearTokens();
  });

  it('adds Authorization from the in-memory access token', async () => {
    saveTokens('abc.def.ghi');
    const interceptor = getRequestInterceptor();
    const config = {
      headers: new AxiosHeaders(),
    };

    const result = await interceptor(config);

    expect(result.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
  });
});
