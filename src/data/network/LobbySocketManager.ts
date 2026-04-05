import { io, Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import type { ApiResponse, LoginResponse, RoomResponse } from '../models/ApiModels';

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
    socket.auth = { token: newToken };
    (socket.io.opts as Record<string, unknown>).query = { token: newToken };
    (socket.io.opts.extraHeaders as Record<string, string>).Authorization = `Bearer ${newToken}`;
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

export class LobbySocketManager {
  private socket: Socket | null = null;

  connect(): void {
    const token = getAccessToken() ?? '';

    this.socket = io(`${BASE_URL}/rooms`, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      auth: { token },
      query: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
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

  onRoomCreated(cb: (room: RoomResponse) => void): void {
    this.socket?.on('room_created', cb);
  }

  onRoomUpdated(cb: (room: RoomResponse) => void): void {
    this.socket?.on('room_updated', cb);
  }

  onRoomDeleted(cb: (roomId: string) => void): void {
    this.socket?.on('room_deleted', cb);
  }

  offAll(): void {
    this.socket?.offAny();
  }
}
