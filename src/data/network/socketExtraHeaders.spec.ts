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

  it('socketIoExtraHeaders includes locale and X-App-Version without auth headers', () => {
    const h = socketIoExtraHeaders();
    expect(h.Authorization).toBeUndefined();
    expect(h['accept-language']).toBe('es');
    expect(h['X-App-Version']).toBe('0.0.0-test');
  });

  it('socketIoAuthPayload keeps the version field for compatibility', () => {
    const a = socketIoAuthPayload('xyz');
    expect(a.token).toBe('xyz');
    expect(a.appVersion).toBe('0.0.0-test');
  });
});
