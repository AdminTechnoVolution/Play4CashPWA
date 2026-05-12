import { create } from 'zustand';

/**
 * Phase D: tracks the live status of every Socket.IO namespace the PWA is using
 * (game, lobby, chat, etc.). Each `SocketManager` reports state transitions via
 * `setStatus(namespace, ...)` and `<ReconnectionBanner />` reflects them.
 *
 * Semantics:
 *  - `connecting` — handshake in flight (first attempt or socket.io reconnect attempt)
 *  - `connected`  — handshake successful
 *  - `reconnecting` — was connected, lost transport, socket.io retrying
 *  - `disconnected` — explicit disconnect (e.g. user left page). Banner ignores these
 *    so we don't show "reconnecting" toasts during normal navigation.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStore {
  /** namespace → current status. */
  statuses: Record<string, ConnectionStatus>;
  /** Sets the status for a namespace. `undefined` clears it (manager torn down). */
  setStatus: (namespace: string, status: ConnectionStatus | undefined) => void;
  /** Convenience: true when any tracked namespace is `connecting`/`reconnecting`. */
  isAnyReconnecting: () => boolean;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  statuses: {},
  setStatus: (namespace, status) =>
    set((s) => {
      const next = { ...s.statuses };
      if (status === undefined) delete next[namespace];
      else next[namespace] = status;
      return { statuses: next };
    }),
  isAnyReconnecting: () => {
    const values = Object.values(get().statuses);
    return values.some((v) => v === 'connecting' || v === 'reconnecting');
  },
}));
