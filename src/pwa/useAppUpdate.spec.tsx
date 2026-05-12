import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const updateServiceWorker = vi.fn(async () => undefined);
let registerSWHandlers: { onRegisteredSW?: (url: string, reg: unknown) => void } = {};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opts: { onRegisteredSW?: (url: string, reg: unknown) => void }) => {
    registerSWHandlers = opts;
    return {
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    };
  },
}));

import { useAppUpdate } from './useAppUpdate';

describe('useAppUpdate', () => {
  beforeEach(() => {
    localStorage.clear();
    updateServiceWorker.mockClear();
    registerSWHandlers = {};
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, reload: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the running version and build metadata', () => {
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.appVersion).toBe('0.0.0-test');
    expect(result.current.appFullVersion).toBe('0.0.0-test+testsha');
    expect(result.current.buildTime).toBe('1970-01-01T00:00:00.000Z');
  });

  it('forced=false until a p4c:force-update event fires', () => {
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.forced).toBe(false);
    expect(result.current.requiredVersion).toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('p4c:force-update', { detail: { requiredVersion: '9.9.9' } }),
      );
    });

    expect(result.current.forced).toBe(true);
    expect(result.current.requiredVersion).toBe('9.9.9');
    expect(result.current.needRefresh).toBe(true);
  });

  it('dismiss() is a no-op when forced=true', () => {
    const { result } = renderHook(() => useAppUpdate());
    act(() => {
      window.dispatchEvent(new CustomEvent('p4c:force-update', { detail: {} }));
    });
    act(() => result.current.dismiss());
    expect(result.current.needRefresh).toBe(true); // still forced
  });

  it('applyUpdate calls updateServiceWorker(true) and reloads', async () => {
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.applyUpdate();
    });

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('still reloads when updateServiceWorker rejects', async () => {
    updateServiceWorker.mockRejectedValueOnce(new Error('no SW'));
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.applyUpdate();
    });

    expect(window.location.reload).toHaveBeenCalled();
  });

  it('dismissOfflineReady persists the seen flag in localStorage', () => {
    const { result } = renderHook(() => useAppUpdate());
    act(() => result.current.dismissOfflineReady());
    expect(localStorage.getItem('p4c_offline_ready_seen')).toBe('1');
  });

  it('schedules a periodic registration.update() poll on registration', () => {
    vi.useFakeTimers();
    try {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      renderHook(() => useAppUpdate());

      const reg = { update: vi.fn().mockResolvedValue(undefined) };
      registerSWHandlers.onRegisteredSW?.('sw.js', reg);

      // Should have scheduled at least one interval (60min default).
      expect(setIntervalSpy).toHaveBeenCalled();
      const calls = setIntervalSpy.mock.calls;
      const last = calls[calls.length - 1];
      expect(last?.[1]).toBeGreaterThanOrEqual(15 * 60 * 1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
