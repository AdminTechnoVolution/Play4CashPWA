import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compareSemver, checkAppMinVersion } from './versionContract';

describe('compareSemver (PWA)', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('returns negative when a < b', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0);
    expect(compareSemver('1.2.3', '2.0.0')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareSemver('1', '1.0.0')).toBe(0);
    expect(compareSemver('1.2', '1.2.1')).toBeLessThan(0);
  });

  it('ignores +build suffixes', () => {
    expect(compareSemver('1.2.3+abc1234', '1.2.3+def5678')).toBe(0);
  });
});

describe('checkAppMinVersion', () => {
  let dispatched: CustomEvent[] = [];
  let originalDispatch: typeof window.dispatchEvent;

  beforeEach(() => {
    dispatched = [];
    originalDispatch = window.dispatchEvent;
    window.dispatchEvent = vi.fn((evt: Event) => {
      dispatched.push(evt as CustomEvent);
      return true;
    });
  });

  afterEach(() => {
    window.dispatchEvent = originalDispatch;
  });

  it('does nothing when header is empty', () => {
    checkAppMinVersion('');
    checkAppMinVersion(null);
    checkAppMinVersion(undefined);
    expect(dispatched).toHaveLength(0);
  });

  it('does not dispatch when running app >= required', () => {
    // __APP_VERSION__ is '0.0.0-test' from vitest.config.ts → numerically 0.0.0
    checkAppMinVersion('0.0.0');
    expect(dispatched).toHaveLength(0);
  });

  it('dispatches p4c:force-update when running app < required', () => {
    checkAppMinVersion('1.0.0');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('p4c:force-update');
    expect((dispatched[0].detail as { requiredVersion: string }).requiredVersion).toBe('1.0.0');
  });

  it('does not re-dispatch the same required version', () => {
    checkAppMinVersion('2.0.0');
    checkAppMinVersion('2.0.0');
    checkAppMinVersion('2.0.0');
    expect(dispatched).toHaveLength(1);
  });

  it('re-dispatches when the required version changes', () => {
    checkAppMinVersion('3.0.0');
    checkAppMinVersion('3.1.0');
    expect(dispatched).toHaveLength(2);
  });
});
