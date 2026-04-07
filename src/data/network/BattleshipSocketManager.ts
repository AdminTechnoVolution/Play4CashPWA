import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
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
    (socket.io.opts as Record<string, unknown>).extraHeaders = { Authorization: `Bearer ${newToken}` };
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

export class BattleshipSocketManager {
  private socket: Socket | null = null;

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      console.error('[SPECTATOR][5] BattleshipSocketManager.connect → no access token, dispatching auth-failure');
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    console.log('[SPECTATOR][5] BattleshipSocketManager.connect → namespace:', BASE_URL + '/naval-battle', '| roomId:', roomId);
    console.log('[SPECTATOR][5] Socket options → transports: polling | query: { token: ***' + token.slice(-6) + ' } | extraHeaders: Authorization Bearer');

    this.socket = io(`${BASE_URL}/naval-battle`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      query: { token },
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    this.socket.on('connect', () => {
      console.log('[SPECTATOR][6] Socket connected → emitting "join" with { room_id:', roomId, '}');
      // Android: emits "join" on connect to subscribe to room events
      // room_id is sent ONLY here (not in query params) so the backend
      // can resolve the user's role (player vs spectator) from the prior REST call
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('connect_error', async (err: Error & { data?: { status?: number } }) => {
      const status = (err as unknown as { data?: { status?: number } }).data?.status;
      console.error('[SPECTATOR] Socket connect_error → status:', status, '| message:', err.message);
      if (status === 401 && this.socket) {
        console.log('[SPECTATOR] 401 → refreshing token and reconnecting');
        try {
          await refreshSocketToken(this.socket);
          this.socket.connect();
        } catch {
          window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
        }
      }
    });

    this.socket.connect();
    console.log('[SPECTATOR][5] socket.connect() called');
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  fire(roomId: string, row: number, col: number): void {
    this.socket?.emit('fire', { room_id: roomId, row, col });
  }

  onGameUpdate(cb: (state: BattleshipState) => void): void {
    this.socket?.on('naval-battle', cb);
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
