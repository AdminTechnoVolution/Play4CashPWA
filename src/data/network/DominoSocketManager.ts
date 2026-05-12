import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';

const NAMESPACE = '/domino';

export class DominoSocketManager {
  private socket: Socket | null = null;
  private onPayload?: (raw: unknown) => void;
  private onConnectedCb?: () => void;

  setOnGamePayload(cb: (raw: unknown) => void): void {
    this.onPayload = cb;
  }

  setOnConnected(cb: () => void): void {
    this.onConnectedCb = cb;
  }

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      query: { token, appVersion: __APP_VERSION__ },
      auth: { token, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    // Phase D: register with global connection store.
    instrumentSocket(this.socket, NAMESPACE);

    this.socket.on('connect', () => {
      this.onConnectedCb?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('domino', (payload: unknown) => {
      this.onPayload?.(payload);
    });

    this.socket.on('connect_error', async (err: Error) => {
      if (isSocketUnauthorizedConnectError(err) && this.socket) {
        try {
          await refreshSocketHandshake(this.socket);
          this.socket.connect();
        } catch {
          window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
        }
      }
    });

    this.socket.connect();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  /** Re-emit join to resync state after room becomes started (Android requestSync). */
  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  playTile(roomId: string, tile: [number, number], side: 'left' | 'right'): void {
    this.socket?.emit('move', { room_id: roomId, tile, side });
  }

  draw(roomId: string): void {
    this.socket?.emit('draw', { room_id: roomId });
  }

  pass(roomId: string): void {
    this.socket?.emit('pass', { room_id: roomId });
  }

  /** @deprecated use setOnGamePayload */
  onGameUpdate(cb: (state: unknown) => void): void {
    this.setOnGamePayload(cb);
  }
}
