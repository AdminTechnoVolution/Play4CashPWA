import { SOCKET_TIMEOUT_MS } from '../../config/api.config';

/**
 * Shared Socket.IO client options.
 *
 * Transport: start with polling so the Socket.IO session is established reliably,
 * then upgrade to WebSocket when the PWA proxy/gateway allows HTTP upgrade.
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
