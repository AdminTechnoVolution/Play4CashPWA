/**
 * Exact port of Android ChessSocketManager.kt
 * Namespace: /chess
 * Events listened: "chess"
 * Events emitted: "join", "move"
 */
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import type { ApiResponse, LoginResponse } from '../models/ApiModels';

let socketRefreshPromise: Promise<void> | null = null;

async function refreshSocketToken(socket: Socket): Promise<void> {
  if (socketRefreshPromise) return socketRefreshPromise;

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

export class ChessSocketManager {
  private socket: Socket | null = null;

  // Android: var onChessMessage: ((JSONObject) -> Unit)? = null
  onChessMessage: ((json: any) => void) | null = null;
  // Android: var onConnected: (() -> Unit)? = null
  onConnected: (() => void) | null = null;
  // Android: var onConnectionError: ((String) -> Unit)? = null
  onConnectionError: ((err: string) => void) | null = null;
  // Android: EVENT_DISCONNECT (optional hook)
  onDisconnected: (() => void) | null = null;

  // Android: val isConnected: Boolean get() = socket?.connected() == true
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Android: fun connect(roomId: String) — ChessSocketManager.kt:37-96
  connect(roomId: string): void {
    this.disconnect();

    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}/chess`, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      forceNew: true,
      query: { token },
      extraHeaders: socketIoExtraHeaders(token),
    });

    // Android: sock.on(Socket.EVENT_CONNECT) { onConnected?.invoke(); sock.emit("join", ...) }
    this.socket.on('connect', () => {
      this.onConnected?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('disconnect', () => {
      this.onDisconnected?.();
    });

    // Android: sock.on(Socket.EVENT_CONNECT_ERROR) { ... }
    this.socket.on('connect_error', async (err: Error & { data?: { status?: number } }) => {
      const status = (err as unknown as { data?: { status?: number } }).data?.status;
      const msg = err.message || '';
      if ((status === 401 || msg.includes('401') || msg.toLowerCase().includes('unauthorized')) && this.socket) {
        try {
          await refreshSocketToken(this.socket);
          this.socket.connect();
        } catch {
          window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
        }
      } else {
        this.onConnectionError?.(msg);
      }
    });

    // Android: sock.on("chess") { args -> onChessMessage?.invoke(payload) }
    this.socket.on('chess', (data: any) => {
      this.onChessMessage?.(data);
    });

    this.socket.connect();
  }

  /**
   * Android: fun move(roomId, fromRow, fromCol, toRow, toCol, promotion?)
   * Backend contract: { room_id, from: { row, col }, to: { row, col }, promotion?: 'q'|'r'|'b'|'n' }
   */
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

  // Android: fun requestSync(roomId: String) — re-emits join
  requestSync(roomId: string): void {
    if (!this.isConnected) return;
    this.socket?.emit('join', { room_id: roomId });
  }

  // Android: fun disconnect()
  disconnect(): void {
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
  }
}
