import { SOCKET_TIMEOUT_MS } from '../../config/api.config';

/** Aligned with Gateway/API Engine.IO ping (see docs/SECURITY-ENV.md §11). */
export const SOCKET_IO_PING_OPTIONS = {
  pingInterval: 25_000,
  pingTimeout: 20_000,
} as const;

/** Shared Socket.IO client options — WebSocket-first with polling fallback. */
export const SOCKET_IO_CLIENT_DEFAULTS = {
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  autoConnect: false as const,
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: SOCKET_TIMEOUT_MS,
  ...SOCKET_IO_PING_OPTIONS,
};
