import type { Socket } from 'socket.io-client';
import { refreshAccessTokenWithLock } from './ApiClient';

export function isSocketUnauthorizedConnectError(err: Error): boolean {
  const status = (err as unknown as { data?: { status?: number } }).data?.status;
  const msg = err.message || '';
  return status === 401 || msg.includes('401') || msg.toLowerCase().includes('unauthorized');
}

export async function refreshSocketHandshake(_socket: Socket): Promise<void> {
  // Refresh the browser session cookie before the next reconnect attempt.
  await refreshAccessTokenWithLock();
}
