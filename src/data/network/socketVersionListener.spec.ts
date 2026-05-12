import { describe, expect, it, vi } from 'vitest';
import { attachVersionMismatchListener } from './socketVersionListener';

interface FakeSocket {
  handlers: Map<string, ((...args: unknown[]) => void)[]>;
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
  off: (ev: string, fn: (...args: unknown[]) => void) => void;
  emit: (ev: string, payload?: unknown) => void;
}

function makeFakeSocket(): FakeSocket {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  return {
    handlers,
    on(ev, fn) {
      const arr = handlers.get(ev) ?? [];
      arr.push(fn);
      handlers.set(ev, arr);
    },
    off(ev, fn) {
      const arr = handlers.get(ev) ?? [];
      handlers.set(ev, arr.filter((h) => h !== fn));
    },
    emit(ev, payload) {
      for (const fn of handlers.get(ev) ?? []) fn(payload);
    },
  };
}

describe('attachVersionMismatchListener', () => {
  it('dispatches p4c:force-update with requiredVersion when the server emits version_mismatch', () => {
    const socket = makeFakeSocket();
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    attachVersionMismatchListener(socket as never);
    socket.emit('version_mismatch', { requiredVersion: '2.0.0' });

    expect(dispatch).toHaveBeenCalledTimes(1);
    const ev = dispatch.mock.calls[0][0] as CustomEvent<{ requiredVersion: string }>;
    expect(ev.type).toBe('p4c:force-update');
    expect(ev.detail).toEqual({ requiredVersion: '2.0.0' });

    dispatch.mockRestore();
  });

  it('survives a payload without requiredVersion', () => {
    const socket = makeFakeSocket();
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

    attachVersionMismatchListener(socket as never);
    socket.emit('version_mismatch');

    const ev = dispatch.mock.calls[0][0] as CustomEvent<{ requiredVersion?: string }>;
    expect(ev.detail.requiredVersion).toBeUndefined();

    dispatch.mockRestore();
  });
});
