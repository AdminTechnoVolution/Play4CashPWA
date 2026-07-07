import { beforeEach, describe, expect, it, vi } from 'vitest';

let tokenState = '';
const clearTokens = vi.fn(() => {
  tokenState = '';
});
const saveTokens = vi.fn((token: string) => {
  tokenState = token;
});
const getAccessToken = vi.fn(() => (tokenState || null));
const saveUserAccount = vi.fn();
const getUserAccount = vi.fn(() => null);
const invalidateAccountCache = vi.fn();
const getUserAccountRemote = vi.fn();
const refreshTokenRemote = vi.fn();
const emitAuthFailureEvent = vi.fn();
const requestRefreshCookieCleared = vi.fn();

vi.mock('../data/auth/AuthSessionStore', () => ({
  saveTokens: (...args: Parameters<typeof saveTokens>) => saveTokens(...args),
  clearTokens: (...args: Parameters<typeof clearTokens>) => clearTokens(...args),
  saveUserAccount: (...args: Parameters<typeof saveUserAccount>) => saveUserAccount(...args),
  getUserAccount: (...args: Parameters<typeof getUserAccount>) => getUserAccount(...args),
  getAccessToken: (...args: Parameters<typeof getAccessToken>) => getAccessToken(...args),
  isCrossTabAuthStorageKey: () => false,
  onAuthBroadcast: () => () => undefined,
}));

vi.mock('../data/network/ApiRepository', () => ({
  apiRepository: {
    login: vi.fn(),
    refreshToken: (...args: Parameters<typeof refreshTokenRemote>) => refreshTokenRemote(...args),
    logout: vi.fn(),
    invalidateAccountCache: (...args: Parameters<typeof invalidateAccountCache>) =>
      invalidateAccountCache(...args),
    getUserAccount: (...args: Parameters<typeof getUserAccountRemote>) =>
      getUserAccountRemote(...args),
  },
}));

vi.mock('../data/network/ApiClient', () => ({
  emitAuthFailureEvent: (...args: Parameters<typeof emitAuthFailureEvent>) =>
    emitAuthFailureEvent(...args),
  requestRefreshCookieCleared: (...args: Parameters<typeof requestRefreshCookieCleared>) =>
    requestRefreshCookieCleared(...args),
}));

vi.mock('../i18n/ApiMessageDisplay', () => ({
  formatApiMessageForDisplay: (value: unknown) => String(value),
}));

describe('authStore loadSession race', () => {
  beforeEach(() => {
    vi.resetModules();
    tokenState = '';
    clearTokens.mockClear();
    saveTokens.mockClear();
    getAccessToken.mockClear();
    saveUserAccount.mockClear();
    getUserAccount.mockClear();
    invalidateAccountCache.mockClear();
    getUserAccountRemote.mockReset();
    refreshTokenRemote.mockReset();
    emitAuthFailureEvent.mockClear();
    requestRefreshCookieCleared.mockClear();
  });

  it('does not clear a newer token when an older session check fails', async () => {
    let resolveRequest!: (value: { id: string; email: string }) => void;
    const pending = new Promise<{ id: string; email: string }>((resolve) => {
      resolveRequest = resolve;
    });
    getUserAccountRemote.mockReturnValueOnce(pending);
    tokenState = 'old-token';

    const { useAuthStore } = await import('./authStore');

    const loadPromise = useAuthStore.getState().loadSession().catch(() => undefined);
    expect(invalidateAccountCache).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalled();

    tokenState = 'fresh-token';
    resolveRequest({ id: 'u-old', email: 'old@example.com' });
    await loadPromise;

    expect(clearTokens).not.toHaveBeenCalled();
    expect(saveUserAccount).not.toHaveBeenCalled();
  });

  it('does not raise session-expired for transient loadSession failures', async () => {
    tokenState = 'existing-token';
    getUserAccountRemote.mockRejectedValueOnce(new Error('error_try_later_message'));

    const { useAuthStore } = await import('./authStore');

    await useAuthStore.getState().loadSession();

    expect(clearTokens).not.toHaveBeenCalled();
    expect(emitAuthFailureEvent).not.toHaveBeenCalled();
  });

  it('rehydrates from the refresh cookie when no access token is in memory', async () => {
    refreshTokenRemote.mockResolvedValueOnce({ token: 'refreshed-token' });
    getUserAccountRemote.mockResolvedValueOnce({ id: 'u1', email: 'a@b' });

    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().loadSession();

    expect(refreshTokenRemote).toHaveBeenCalledTimes(1);
    expect(saveTokens).toHaveBeenCalledWith('refreshed-token');
    expect(saveUserAccount).toHaveBeenCalledWith({ id: 'u1', email: 'a@b' });
  });

  it('boots with the cached user so a refresh does not flash the login screen', async () => {
    getUserAccount.mockImplementationOnce(
      () => ({ id: 'cached-1', email: 'cached@example.com' } as any),
    );

    const { useAuthStore } = await import('./authStore');

    expect(useAuthStore.getState().user).toEqual({
      id: 'cached-1',
      email: 'cached@example.com',
    });
    expect(useAuthStore.getState().authHydrated).toBe(false);
  });
});
