import type { Socket } from 'socket.io-client';

const RESYNC_THROTTLE_MS = 1500;

// Throttle per transport, not per namespace. A newly-created game socket must never
// inherit the throttle window from the stale socket it replaced, otherwise the first
// authoritative recovery request can be silently discarded.
const lastResyncBySocket = new WeakMap<Socket, number>();
const pendingResyncBySocket = new WeakMap<Socket, { namespace: string; roomId: string }>();
const resyncConnectListenerInstalled = new WeakSet<Socket>();

function emitConnectedSocketResync(socket: Socket, namespace: string, roomId: string): void {
  const now = Date.now();
  const last = lastResyncBySocket.get(socket) ?? 0;
  if (now - last < RESYNC_THROTTLE_MS) return;
  lastResyncBySocket.set(socket, now);
  socket.emit('get_state', { room_id: roomId });
}

export function emitSocketResync(
  socket: Socket | null | undefined,
  namespace: string,
  roomId: string,
): void {
  if (!socket) return;
  if (socket.connected) {
    pendingResyncBySocket.delete(socket);
    emitConnectedSocketResync(socket, namespace, roomId);
    return;
  }

  // A status poll can discover `started` while Socket.IO is still reconnecting.
  // Keep the latest request and flush it as soon as the transport is usable.
  pendingResyncBySocket.set(socket, { namespace, roomId });
  if (resyncConnectListenerInstalled.has(socket)) return;
  resyncConnectListenerInstalled.add(socket);
  socket.on('connect', () => {
    const pending = pendingResyncBySocket.get(socket);
    if (!pending) return;
    pendingResyncBySocket.delete(socket);
    emitConnectedSocketResync(socket, pending.namespace, pending.roomId);
  });
}

export function clearSocketResyncThrottle(namespace: string): void {
  // WeakMap entries disappear with their socket. Keep the namespace argument for
  // compatibility with existing managers.
  void namespace;
}
