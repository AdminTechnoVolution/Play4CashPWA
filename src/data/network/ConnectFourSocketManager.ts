/**
 * 2-player staked game socket — mirrors `ChessSocketManager` (namespace/event differ).
 * Namespace: /connect-four
 * Events listened: "connect-four"
 * Events emitted: "join", "drop_disc", "forfeit"
 */
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders, acceptLanguageTag } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';

const NAMESPACE = '/connect-four';
const EVENT = 'connect-four';

export class ConnectFourSocketManager {
  private socket: Socket | null = null;
  private onPayload?: (raw: unknown) => void;
  private onConnectedCb?: () => void;
  private onConnectionErrorCb?: (msg: string) => void;
  private onDisconnectedCb?: () => void;
  private onProxyReconnectedCb?: () => void;

  setOnDisconnected(cb: () => void): void {
    this.onDisconnectedCb = cb;
  }

  setOnProxyReconnected(cb: () => void): void {
    this.onProxyReconnectedCb = cb;
  }

  setOnGamePayload(cb: (raw: unknown) => void): void {
    this.onPayload = cb;
  }

  setOnConnected(cb: () => void): void {
    this.onConnectedCb = cb;
  }

  setOnConnectionError(cb: (msg: string) => void): void {
    this.onConnectionErrorCb = cb;
  }

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

    const lang = acceptLanguageTag();

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      forceNew: true,
      query: { token, appVersion: __APP_VERSION__, lang },
      auth: { token, appVersion: __APP_VERSION__, lang },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE);

    this.socket.on('connect', () => {
      this.onConnectedCb?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('disconnect', () => {
      this.onDisconnectedCb?.();
    });

    this.socket.on(EVENT, (payload: unknown) => {
      this.onPayload?.(payload);
    });

    this.socket.on('proxy_reconnected', () => {
      this.onProxyReconnectedCb?.();
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
        this.onConnectionErrorCb?.(err.message || '');
      }
    });

    this.socket.connect();
  }

  /** Re-emit join to resync state or re-attempt start when both players are in the room. */
  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  dropDisc(roomId: string, col: number): boolean {
    if (!this.isConnected) return false;
    this.socket?.emit('drop_disc', { room_id: roomId, col });
    return true;
  }

  forfeit(roomId: string): void {
    if (!this.isConnected) return;
    this.socket?.emit('forfeit', { room_id: roomId });
  }

  disconnect(): void {
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }
}
