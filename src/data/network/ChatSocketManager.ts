import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import type { ApiResponse, LoginResponse, ChatMessage } from '../models/ApiModels';

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
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

export class ChatSocketManager {
  private socket: Socket | null = null;

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}/chat`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      auth: { token },
      query: { token, room_id: roomId },
    });

    this.socket.on('connect', () => {
      // Android: emits "join" on connect to subscribe to room chat
      this.socket?.emit('join', { room_id: roomId });
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

  sendGreeting(roomId: string, greetingId: string): void {
    this.socket?.emit('greeting', { room_id: roomId, greeting_id: greetingId });
  }

  onMessage(cb: (msg: ChatMessage) => void): void {
    this.socket?.on('chat', cb);
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
