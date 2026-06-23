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
    emitAuthFailureEvent.mockClear();
    requestRefreshCookieCleared.mockClear();
  });

  it('does not clear a newer token when an older session check fails', async () => {
    let rejectRequest!: (reason?: unknown) => void;
    const pending = new Promise<never>((_, reject) => {
      rejectRequest = reject;
    });
    getUserAccountRemote.mockReturnValueOnce(pending);

    const { useAuthStore } = await import('./authStore');

    const loadPromise = useAuthStore.getState().loadSession();
    expect(invalidateAccountCache).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalled();

    tokenState = 'fresh-token';
    rejectRequest(new Error('unauthorized'));
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
});
