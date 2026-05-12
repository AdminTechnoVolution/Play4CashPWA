import type { Socket } from 'socket.io-client';
import { refreshSocketHandshake } from './socketSessionRefresh';

/**
 * Phase E — bridges the Gateway's periodic `auth_expired` event into a silent
 * refresh + reconnect cycle. Mounted by every SocketManager right after the socket
 * is constructed so we cover every namespace uniformly (game + lobby + chat).
 *
 * What the Gateway emits:
 *   `auth_expired` with payload `{ reason: 'token_invalid' }` — sent before the
 *   gateway forcibly disconnects the socket.
 *
 * What we do here:
 *   1. Refresh the access token via the same single-flight lock that Axios 401
 *      handling and `loadSession` use (so we never run multiple refreshes in
 *      parallel from different sockets).
 *   2. Rewrite the socket's `auth`/`query`/`extraHeaders` with the new token.
 *   3. Let socket.io's existing reconnection (Phase D) pick up the new token on
 *      the next attempt — we don't call `connect()` ourselves because the server
 *      will close the transport milliseconds after the event and socket.io will
 *      handle the retry with the new handshake automatically.
 *
 * If the refresh fails (e.g. refresh cookie expired) we fall back to the global
 * `p4c:auth-failure` event, the same path that Axios uses for hard 401s.
 *
 * Idempotent per socket instance — `socket.off` is called first so reconnects
 * don't accumulate duplicate listeners.
 */
export function attachAuthExpiredListener(socket: Socket): void {
  const handler = async () => {
    try {
      await refreshSocketHandshake(socket);
      // socket.io will retry the handshake with the freshly rewritten auth/query
      // because the server kicked us with a regular `disconnect` event.
    } catch {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
    }
  };
  socket.off('auth_expired');
  socket.on('auth_expired', handler);
}
