import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../auth/AuthSessionStore', () => ({
  getLanguage: () => 'es',
}));

import {
  acceptLanguageTag,
  socketIoAuthPayload,
  socketIoExtraHeaders,
} from './socketExtraHeaders';

describe('socketExtraHeaders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acceptLanguageTag delegates to AuthSessionStore.getLanguage()', () => {
    expect(acceptLanguageTag()).toBe('es');
  });

  it('socketIoExtraHeaders includes Bearer token, locale, and X-App-Version', () => {
    const h = socketIoExtraHeaders('AAA.BBB.CCC');
    expect(h.Authorization).toBe('Bearer AAA.BBB.CCC');
    expect(h['accept-language']).toBe('es');
    expect(h['X-App-Version']).toBe('0.0.0-test');
  });

  it('socketIoAuthPayload mirrors the version under appVersion (browser fallback)', () => {
    const a = socketIoAuthPayload('xyz');
    expect(a.token).toBe('xyz');
    expect(a.appVersion).toBe('0.0.0-test');
  });
});
