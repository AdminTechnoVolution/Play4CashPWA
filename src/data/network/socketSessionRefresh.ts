/**
 * WebSocket auth: the access JWT is duplicated in the Socket.IO `query` (and headers) because the
 * Play4Cash gateway validates the handshake that way. Do not log handshake URLs or token values.
 * Prefer server/gateway logs that redact `token=…` query params.
 */
import type { Socket } from 'socket.io-client';
import { refreshAccessTokenWithLock } from './ApiClient';
import { socketIoExtraHeaders } from './socketExtraHeaders';

function shallowObjectRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

/**
 * True when the socket failed to connect due to auth (refresh + reconnect is appropriate).
 */
export function isSocketUnauthorizedConnectError(err: Error): boolean {
  const status = (err as unknown as { data?: { status?: number } }).data?.status;
  const msg = err.message || '';
  return (
    status === 401 ||
    msg.includes('401') ||
    msg.toLowerCase().includes('unauthorized')
  );
}

/**
 * Refresh JWT (same single-flight lock as Axios 401 / `loadSession`) and apply the new
 * token to this socket's handshake so the next `connect()` succeeds.
 * Preserves non-token fields in `query` / `auth` (e.g. chat `lang`).
 */
export async function refreshSocketHandshake(socket: Socket): Promise<void> {
  const newToken = await refreshAccessTokenWithLock();
  const opts = socket.io.opts as Record<string, unknown>;

  opts.extraHeaders = socketIoExtraHeaders(newToken);

  const prevQuery = shallowObjectRecord(opts.query);
  opts.query = { ...prevQuery, token: newToken };

  const prevAuth = shallowObjectRecord(socket.auth);
  const mergedAuth = { ...prevAuth, token: newToken };
  socket.auth = mergedAuth;
  opts.auth = mergedAuth;
}
