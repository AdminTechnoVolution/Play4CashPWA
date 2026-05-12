import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Socket } from 'socket.io-client';

const refreshSocketHandshake = vi.fn();
vi.mock('./socketSessionRefresh', () => ({
  refreshSocketHandshake: (...args: unknown[]) => refreshSocketHandshake(...args),
}));

import { attachAuthExpiredListener } from './socketAuthExpiredListener';

/**
 * Phase E — PWA-side contract for the Gateway's revalidation sweep.
 *
 * The listener must:
 *  - Trigger `refreshSocketHandshake` so the next socket.io reconnect uses the new
 *    JWT (socket.io's built-in reconnection handles the actual handshake retry).
 *  - On refresh failure, dispatch `p4c:auth-failure` so the global auth handler
 *    (same as the Axios 401 path) takes over and forces a clean re-login.
 *  - Be idempotent across re-attachments: re-binding doesn't accumulate listeners.
 */
type Handler = (...args: unknown[]) => void;

function makeFakeSocket() {
  const handlers = new Map<string, Handler>();
  return {
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
    }),
    fire(event: string, ...args: unknown[]) {
      return handlers.get(event)?.(...args);
    },
  };
}

describe('attachAuthExpiredListener (Phase E)', () => {
  beforeEach(() => {
    refreshSocketHandshake.mockReset();
  });

  it('calls refreshSocketHandshake when auth_expired fires', async () => {
    const fake = makeFakeSocket();
    refreshSocketHandshake.mockResolvedValueOnce(undefined);
    attachAuthExpiredListener(fake as unknown as Socket);
    await fake.fire('auth_expired', { reason: 'token_invalid' });
    expect(refreshSocketHandshake).toHaveBeenCalledTimes(1);
    expect(refreshSocketHandshake).toHaveBeenCalledWith(fake);
  });

  it('dispatches p4c:auth-failure when the silent refresh throws', async () => {
    const fake = makeFakeSocket();
    refreshSocketHandshake.mockRejectedValueOnce(new Error('refresh denied'));
    const events: string[] = [];
    const onAuthFailure = () => events.push('p4c:auth-failure');
    window.addEventListener('p4c:auth-failure', onAuthFailure);

    attachAuthExpiredListener(fake as unknown as Socket);
    await fake.fire('auth_expired');

    expect(events).toEqual(['p4c:auth-failure']);
    window.removeEventListener('p4c:auth-failure', onAuthFailure);
  });

  it('removes any prior listener before binding (idempotent across reconnects)', () => {
    const fake = makeFakeSocket();
    attachAuthExpiredListener(fake as unknown as Socket);
    expect(fake.off).toHaveBeenCalledWith('auth_expired');
    expect(fake.on).toHaveBeenCalledWith('auth_expired', expect.any(Function));
  });
});
