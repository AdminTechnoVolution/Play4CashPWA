import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import type { ApiResponse, LoginResponse, BattleshipState } from '../models/ApiModels';

let socketRefreshPromise: Promise<void> | null = null;

async function refreshSocketToken(socket: Socket): Promise<void> {
  if (socketRefreshPromise) {
    return socketRefreshPromise;
  }

  socketRefreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login/refresh', {
      refreshToken,
    });
    const data = res.data?.data;
    if (!data?.token || !data?.refreshToken) throw new Error('Invalid refresh response');

    saveTokens(data.token, data.refreshToken);

    const newToken = data.token;
    (socket.io.opts as Record<string, unknown>).query = { token: newToken };
    (socket.io.opts as Record<string, unknown>).extraHeaders = socketIoExtraHeaders(newToken);
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

export class BattleshipSocketManager {
  private socket: Socket | null = null;
  private gameUpdateCb?: (data: BattleshipState) => void;

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}/naval-battle`, {
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

    this.socket.on('naval-battle', (payload: unknown) => {
      this.gameUpdateCb?.(payload as BattleshipState);
    });

    this.socket.on('connect_error', async (err: Error & { data?: { status?: number } }) => {
      const status = (err as unknown as { data?: { status?: number } }).data?.status;
      if (status === 401 && this.socket) {
        try {
          await refreshSocketToken(this.socket);
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

  fire(roomId: string, row: number, col: number): void {
    this.socket?.emit('fire', { room_id: roomId, row, col });
  }

  onGameUpdate(cb: (state: BattleshipState) => void): void {
    this.gameUpdateCb = cb;
  }

  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
