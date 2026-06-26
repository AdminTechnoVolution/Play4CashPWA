import { SOCKET_TIMEOUT_MS } from '../../config/api.config';

/**
 * Shared Socket.IO client options.
 *
 * Transport: try WebSocket first and fall back to polling. Production supports
 * HTTP upgrade through the PWA proxy/gateway; polling remains as a safety net.
 * Server pingInterval/pingTimeout are negotiated
 * from the Engine.IO OPEN packet; do NOT set them on the client.
 */
export const SOCKET_IO_CLIENT_DEFAULTS = {
  withCredentials: true,
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  autoConnect: false as const,
  forceNew: false,
  multiplex: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: SOCKET_TIMEOUT_MS,
};
