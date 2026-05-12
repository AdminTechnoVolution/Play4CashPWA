import type { Socket } from 'socket.io-client';

/**
 * Bridges the Gateway's `version_mismatch` event to the global `p4c:force-update` event so
 * the PWA's `AppUpdateModal` switches to "forced" mode and offers the user a single
 * "Update now" action.
 *
 * Call once per socket right after construction. Idempotent within a single Socket
 * instance (re-attaching just adds a fresh listener — Socket.IO disposes them on
 * disconnect, but `socket.off` ensures we don't double-bind during reconnects).
 */
export function attachVersionMismatchListener(socket: Socket): void {
  const handler = (payload?: { requiredVersion?: string }) => {
    window.dispatchEvent(
      new CustomEvent('p4c:force-update', {
        detail: { requiredVersion: payload?.requiredVersion },
      }),
    );
  };
  socket.off('version_mismatch', handler);
  socket.on('version_mismatch', handler);
}
