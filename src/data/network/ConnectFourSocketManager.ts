import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
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
    instrumentSocket(this.socket, NAMESPACE);

    this.socket.on('connect', () => {
      this.onConnectedCb?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on(EVENT, (payload: unknown) => {
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
      } else {
        this.onConnectionErrorCb?.(err.message || '');
      }
    });

    this.socket.connect();
  }

  requestSync(roomId: string): void {
    if (!this.isConnected) return;
    this.socket?.emit('join', { room_id: roomId });
  }

  getState(roomId: string): void {
    if (!this.isConnected) return;
    this.socket?.emit('get_state', { room_id: roomId });
  }

  dropDisc(roomId: string, col: number): void {
    if (!this.isConnected) return;
    this.socket?.emit('drop_disc', { room_id: roomId, col });
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
