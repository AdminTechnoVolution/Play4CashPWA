import type { Socket } from 'socket.io-client';

const RESYNC_THROTTLE_MS = 1500;

const lastResyncByNamespace = new Map<string, number>();

export function emitSocketResync(
  socket: Socket | null | undefined,
  namespace: string,
  roomId: string,
): void {
  if (!socket?.connected) return;
  const now = Date.now();
  const last = lastResyncByNamespace.get(namespace) ?? 0;
  if (now - last < RESYNC_THROTTLE_MS) return;
  lastResyncByNamespace.set(namespace, now);
  socket.emit('get_state', { room_id: roomId });
}

export function clearSocketResyncThrottle(namespace: string): void {
  lastResyncByNamespace.delete(namespace);
}
