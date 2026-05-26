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
 *  3. Central `proxy_reconnected` / manager `reconnect` → registered resync handlers
 *     so every namespace re-joins without per-manager duplicate wiring.
 *
 * Every `SocketManager.connect()` should call `instrumentSocket(socket, namespace)` right
 * after creating the socket, and `releaseSocket(namespace)` from `disconnect()`.
 */

const liveSockets = new Map<string, Socket>();
const resyncHandlers = new Map<string, () => void>();

export function registerSocketResync(namespace: string, handler: () => void): () => void {
  resyncHandlers.set(namespace, handler);
  return () => {
    if (resyncHandlers.get(namespace) === handler) resyncHandlers.delete(namespace);
  };
}

function triggerSocketResync(namespace: string): void {
  try {
    resyncHandlers.get(namespace)?.();
  } catch {
    /* handler owns error surfacing */
  }
  useConnectionStore.getState().recordResync(namespace);
}

export type InstrumentSocketOptions = {
  onResync?: () => void;
};

/**
 * Wire status/registry listeners onto a freshly created Socket.IO client.
 * Idempotent per-namespace: replaces any previous binding.
 */
export function instrumentSocket(
  socket: Socket,
  namespace: string,
  options?: InstrumentSocketOptions,
): void {
  liveSockets.set(namespace, socket);
  const setStatus = useConnectionStore.getState().setStatus;

  if (options?.onResync) {
    registerSocketResync(namespace, options.onResync);
  }

  setStatus(namespace, 'connecting');
  attachAuthExpiredListener(socket);

  socket.on('connect', () => setStatus(namespace, 'connected'));

  socket.on('disconnect', (reason: string) => {
    if (reason === 'io client disconnect' || reason === 'io server disconnect') {
      setStatus(namespace, 'disconnected');
    } else {
      setStatus(namespace, 'reconnecting');
    }
  });

  socket.on('proxy_reconnected', () => {
    triggerSocketResync(namespace);
  });

  const ioManager = (socket as unknown as { io?: { on: (ev: string, cb: () => void) => void } }).io;
  if (ioManager) {
    ioManager.on('reconnect_attempt', () => setStatus(namespace, 'reconnecting'));
    ioManager.on('reconnect', () => {
      setStatus(namespace, 'connected');
      triggerSocketResync(namespace);
    });
    ioManager.on('reconnect_failed', () => setStatus(namespace, 'disconnected'));
  }
}

/**
 * Removes the socket from the live registry and clears its store entry.
 * Call from `SocketManager.disconnect()` to keep the banner clean on intentional teardown.
 */
export function releaseSocket(namespace: string): void {
  liveSockets.delete(namespace);
  resyncHandlers.delete(namespace);
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
