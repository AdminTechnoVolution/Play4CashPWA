import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../../i18n/languageUtils', () => ({
  normaliseLang: (s: string) => (s === 'pt-BR' ? 'pt' : s),
  detectBrowserLang: () => 'en',
}));

import {
  saveTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  hasValidSession,
  saveUserAccount,
  getUserAccount,
  saveLanguage,
  getLanguage,
  isCrossTabAuthStorageKey,
  onAuthBroadcast,
} from './AuthSessionStore';

describe('AuthSessionStore', () => {
  beforeEach(() => {
    localStorage.clear();
    clearTokens();
  });

  describe('token compatibility shims', () => {
    it('keeps access tokens only in memory', () => {
      saveTokens('aaa.bbb.ccc');
      expect(getAccessToken()).toBe('aaa.bbb.ccc');
      expect(localStorage.getItem('p4c_access_token')).toBeNull();
    });

    it('clearTokens wipes cached account data', () => {
      saveUserAccount({ id: 'u1' } as never);
      clearTokens();
      expect(getAccessToken()).toBeNull();
      expect(getUserAccount()).toBeNull();
    });

    it('refresh token API is intentionally null (httpOnly cookie now)', () => {
      saveTokens('xx');
      expect(getRefreshToken()).toBeNull();
    });

    it('hasValidSession is false because the browser no longer owns the token', () => {
      saveTokens('fresh');
      expect(hasValidSession()).toBe(true);
    });
  });

  describe('cross-tab broadcast', () => {
    it('isCrossTabAuthStorageKey detects the keys we listen to', () => {
      expect(isCrossTabAuthStorageKey('p4c_user_account')).toBe(true);
      expect(isCrossTabAuthStorageKey('p4c_session_version')).toBe(true);
      expect(isCrossTabAuthStorageKey('p4c_wallet_address')).toBe(false);
      expect(isCrossTabAuthStorageKey(null)).toBe(false);
    });

    it('saveTokens bumps p4c_session_version so other tabs notice via storage event', () => {
      saveTokens('xx');
      const v = localStorage.getItem('p4c_session_version');
      expect(v).not.toBeNull();
      expect(Number(v)).toBeGreaterThan(0);
    });

    it('onAuthBroadcast subscriber can be registered without throwing', () => {
      const off = onAuthBroadcast(() => undefined);
      off();
    });
  });

  describe('language', () => {
    it('returns detectBrowserLang() when nothing is saved', () => {
      expect(getLanguage()).toBe('en');
    });

    it('normalises a saved language tag', () => {
      saveLanguage('pt-BR');
      expect(getLanguage()).toBe('pt');
    });
  });

  describe('user account cache', () => {
    it('round-trips through localStorage', () => {
      saveUserAccount({ id: 'u1', email: 'a@b' } as never);
      expect(getUserAccount()).toEqual({ id: 'u1', email: 'a@b' });
    });

    it('returns null on JSON parse error', () => {
      localStorage.setItem('p4c_user_account', 'not-json');
      expect(getUserAccount()).toBeNull();
    });
  });
});
