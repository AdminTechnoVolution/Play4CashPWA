import type { Socket } from 'socket.io-client';

const RESYNC_THROTTLE_MS = 1500;

const lastResyncByNamespace = new Map<string, number>();
const pendingResyncBySocket = new WeakMap<Socket, { namespace: string; roomId: string }>();
const resyncConnectListenerInstalled = new WeakSet<Socket>();

function emitConnectedSocketResync(socket: Socket, namespace: string, roomId: string): void {
  const now = Date.now();
  const last = lastResyncByNamespace.get(namespace) ?? 0;
  if (now - last < RESYNC_THROTTLE_MS) return;
  lastResyncByNamespace.set(namespace, now);
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
  lastResyncByNamespace.delete(namespace);
}
