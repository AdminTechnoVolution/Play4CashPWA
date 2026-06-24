import { SOCKET_TIMEOUT_MS } from '../../config/api.config';

/**
 * Shared Socket.IO client options.
 *
 * Transport: polling first, then upgrade to WebSocket when stable. Forcing
 * WebSocket-first breaks Vite dev proxy / double-hop Gateway setups — the WS
 * handshake succeeds then drops with "transport error" within milliseconds
 * handshake succeeds then drops with "transport error" within milliseconds.
 * Server pingInterval/pingTimeout are negotiated
 * from the Engine.IO OPEN packet; do NOT set them on the client.
 */
export const SOCKET_IO_CLIENT_DEFAULTS = {
  withCredentials: true,
  transports: ['polling', 'websocket'] as ('websocket' | 'polling')[],
  autoConnect: false as const,
  forceNew: false,
  multiplex: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: SOCKET_TIMEOUT_MS,
};
