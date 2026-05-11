import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import type { HalmaState } from '../models/ApiModels';

export class HalmaSocketManager {
  private socket: Socket | null = null;

  private gameUpdateCb?: (data: HalmaState) => void;

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}/halma`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      query: { token },
      extraHeaders: socketIoExtraHeaders(token),
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('halma', (payload: unknown) => {
      this.gameUpdateCb?.(payload as HalmaState);
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
  }

  // Android: flat fields — from_row, from_col, to_row, to_col
  move(roomId: string, fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    this.socket?.emit('move', {
      room_id: roomId,
      from_row: fromRow,
      from_col: fromCol,
      to_row: toRow,
      to_col: toCol,
    });
  }

  endTurn(roomId: string): void {
    this.socket?.emit('end_turn', { room_id: roomId });
  }

  onGameUpdate(cb: (state: HalmaState) => void): void {
    this.gameUpdateCb = cb;
  }

  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
