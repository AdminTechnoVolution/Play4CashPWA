import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { apiClient, bareClient } from './ApiClient';
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

describe('ApiClient session recovery', () => {
  const adapter = apiClient.defaults.adapter;
  const bareAdapter = bareClient.defaults.adapter;
  beforeEach(() => { clearTokens(); });
  afterEach(() => { apiClient.defaults.adapter = adapter; bareClient.defaults.adapter = bareAdapter; vi.restoreAllMocks(); });
  function denied(config: any, message = 'Unauthorized') {
    return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined,
      { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { message } });
  }
  function ok(config: any, data: unknown) { return { status: 200, statusText: 'OK', headers: {}, config, data }; }
  it('retries concurrent failed requests with the renewed bearer and one refresh', async () => {
    saveTokens('old-token');
    const refresh = vi.fn(async (config: any) => ok(config, { data: { token: 'renewed-token' } }));
    bareClient.defaults.adapter = refresh;
    const used: unknown[] = [];
    apiClient.defaults.adapter = async config => {
      const auth = config.headers.get('Authorization'); used.push(auth);
      if (auth !== 'Bearer renewed-token') throw denied(config);
      return ok(config, { success: true });
    };
    await Promise.all([apiClient.get('/api/user/account'), apiClient.get('/api/rooms/active')]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(used.filter(value => value === 'Bearer renewed-token')).toHaveLength(2);
  });
  it('recovers a missing access token using the refresh cookie flow', async () => {
    bareClient.defaults.adapter = async config => ok(config, { data: { token: 'cookie-restored-token' } });
    apiClient.defaults.adapter = async config => {
      if (config.headers.get('Authorization') !== 'Bearer cookie-restored-token') throw denied(config, 'No token provided');
      return ok(config, { success: true });
    };
    await expect(apiClient.get('/api/payments/balance')).resolves.toMatchObject({ status: 200 });
  });
  it('rejects an empty refresh result instead of replaying with stale credentials', async () => {
    saveTokens('old-token');
    bareClient.defaults.adapter = async config => ok(config, { data: {} });
    const request = vi.fn(async (config: any) => { throw denied(config); });
    apiClient.defaults.adapter = request;
    await expect(apiClient.get('/api/user/account')).rejects.toThrow('error_session_expired');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
