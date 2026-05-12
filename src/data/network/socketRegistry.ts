import type { Socket } from 'socket.io-client';
import { useConnectionStore } from '../../store/connectionStore';
import { attachAuthExpiredListener } from './socketAuthExpiredListener';

/**
 * Phase D: cross-cutting plumbing for Socket.IO clients.
 *
 *  1. Tracks every live socket in a Map keyed by namespace so `useVisibilityReconnect`
 *     can iterate and kick `connect()` on any socket that's been silently dropped while
 *     the tab was in the background (iOS Safari aggressively kills WebSockets and JS
 *     timers when the app is suspended).
 *
 *  2. Bridges socket lifecycle events into `useConnectionStore` so the global
 *     `<ReconnectionBanner />` shows up the moment any namespace starts retrying.
 *
 * Every `SocketManager.connect()` should call `instrumentSocket(socket, namespace)` right
 * after creating the socket, and `releaseSocket(namespace)` from `disconnect()`.
 */

const liveSockets = new Map<string, Socket>();

/**
 * Wire status/registry listeners onto a freshly created Socket.IO client.
 * Idempotent per-namespace: replaces any previous binding.
 */
export function instrumentSocket(socket: Socket, namespace: string): void {
  // If a previous socket was registered for this namespace, drop it from the
  // registry first to avoid leaks (the SocketManager owns its lifecycle).
  liveSockets.set(namespace, socket);
  const setStatus = useConnectionStore.getState().setStatus;

  setStatus(namespace, 'connecting');

  // Phase E: every socket needs the auth-expired bridge so a Gateway revalidation
  // sweep can trigger a silent token refresh from anywhere in the app without
  // each SocketManager having to wire it independently.
  attachAuthExpiredListener(socket);

  socket.on('connect', () => setStatus(namespace, 'connected'));

  // Either side closed the transport. `io server disconnect` is final (server kicked us);
  // anything else is a transient drop and socket.io will retry on its own.
  socket.on('disconnect', (reason: string) => {
    if (reason === 'io client disconnect' || reason === 'io server disconnect') {
      setStatus(namespace, 'disconnected');
    } else {
      setStatus(namespace, 'reconnecting');
    }
  });

  // socket.io manager events for reconnect attempts (best-effort: some envs strip them).
  // We attach via the underlying io manager so the events fire even when no listener
  // is on the socket itself.
  const ioManager = (socket as unknown as { io?: { on: (ev: string, cb: () => void) => void } }).io;
  if (ioManager) {
    ioManager.on('reconnect_attempt', () => setStatus(namespace, 'reconnecting'));
    ioManager.on('reconnect', () => setStatus(namespace, 'connected'));
    ioManager.on('reconnect_failed', () => setStatus(namespace, 'disconnected'));
  }
}

/**
 * Removes the socket from the live registry and clears its store entry.
 * Call from `SocketManager.disconnect()` to keep the banner clean on intentional teardown.
 */
export function releaseSocket(namespace: string): void {
  liveSockets.delete(namespace);
  useConnectionStore.getState().setStatus(namespace, undefined);
}

/**
 * Iterate all live sockets and, for any that's currently disconnected, force a
 * `connect()` attempt. Used by `useVisibilityReconnect` so a player who tabbed
 * away and came back sees their session re-establish immediately rather than
 * waiting for socket.io's next built-in retry tick (which can be 5 s+).
 */
export function reconnectAllStaleSockets(): void {
  for (const socket of liveSockets.values()) {
    if (!socket.connected) {
      try {
        socket.connect();
      } catch {
        // Socket may already be in a connecting state; socket.io will resolve it.
      }
    }
  }
}
