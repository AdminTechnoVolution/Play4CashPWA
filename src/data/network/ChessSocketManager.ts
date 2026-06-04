/**
 * Exact port of Android ChessSocketManager.kt
 * Namespace: /chess
 * Events listened: "chess"
 * Events emitted: "join", "move"
 */
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { attachGameResultListener } from '../../util/playRoomSession';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';

const NAMESPACE = '/chess';

export class ChessSocketManager {
  private socket: Socket | null = null;
  private sessionRoomId: string | null = null;

  onChessMessage: ((json: any) => void) | null = null;
  onConnected: (() => void) | null = null;
  onConnectionError: ((err: string) => void) | null = null;
  onDisconnected: (() => void) | null = null;

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(roomId: string): void {
    this.disconnect();

    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.sessionRoomId = roomId;

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      ...SOCKET_IO_CLIENT_DEFAULTS,
      query: { token, appVersion: __APP_VERSION__ },
      auth: { token, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    attachGameResultListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE, {
      onResync: () => {
        if (this.sessionRoomId) this.requestSync(this.sessionRoomId);
      },
    });

    this.socket.on('connect', () => {
      this.onConnected?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('disconnect', () => {
      this.onDisconnected?.();
    });

    this.socket.on('connect_error', async (err: Error) => {
      if (isSocketUnauthorizedConnectError(err) && this.socket) {
        try {
          await refreshSocketHandshake(this.socket);
          this.socket.connect();
        } catch {
          window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
        }
      } else {
        this.onConnectionError?.(err.message || '');
      }
    });

    this.socket.on('chess', (data: any) => {
      this.onChessMessage?.(data);
    });

    this.socket.connect();
  }

  move(
    roomId: string,
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotion?: string | null,
  ): void {
    if (!this.isConnected) return;
    const payload: any = {
      room_id: roomId,
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
    };
    if (promotion && promotion.trim()) {
      payload.promotion = promotion.trim().toLowerCase().charAt(0);
    }
    this.socket?.emit('move', payload);
  }

  requestSync(roomId: string): void {
    if (!this.isConnected) return;
    this.socket?.emit('join', { room_id: roomId });
  }

  disconnect(): void {
    this.sessionRoomId = null;
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }
}
