/**
 * Exact port of Android ChessSocketManager.kt
 * Namespace: /chess
 * Events listened: "chess"
 * Events emitted: "join", "move"
 */
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';

const NAMESPACE = '/chess';

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

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      forceNew: true,
      query: { token, appVersion: __APP_VERSION__ },
      auth: { token, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    // Phase D: register with global connection store for ReconnectionBanner + visibility hook.
    instrumentSocket(this.socket, NAMESPACE);

    // Android: sock.on(Socket.EVENT_CONNECT) { onConnected?.invoke(); sock.emit("join", ...) }
    this.socket.on('connect', () => {
      this.onConnected?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('disconnect', () => {
      this.onDisconnected?.();
    });

    // Android: sock.on(Socket.EVENT_CONNECT_ERROR) { ... }
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
    releaseSocket(NAMESPACE);
  }
}
