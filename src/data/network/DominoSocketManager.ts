import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL } from '../../config/api.config';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { attachGameResultListener } from '../../util/playRoomSession';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';

const NAMESPACE = '/domino';

export class DominoSocketManager {
  private socket: Socket | null = null;
  private sessionRoomId: string | null = null;
  private onPayload?: (raw: unknown) => void;
  private onConnectedCb?: () => void;

  setOnGamePayload(cb: (raw: unknown) => void): void {
    this.onPayload = cb;
  }

  setOnConnected(cb: () => void): void {
    this.onConnectedCb = cb;
  }

  connect(roomId: string): void {
    this.disconnect();


    this.sessionRoomId = roomId;

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      ...SOCKET_IO_CLIENT_DEFAULTS,
      query: { appVersion: __APP_VERSION__ },
      auth: { appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(),
    });

    attachVersionMismatchListener(this.socket);
    attachGameResultListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE, {
      onResync: () => {
        if (this.sessionRoomId) this.requestSync(this.sessionRoomId);
      },
    });

    this.socket.on('connect', () => {
      this.onConnectedCb?.();
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('domino', (payload: unknown) => {
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
      }
    });

    this.socket.connect();
  }

  disconnect(): void {
    this.sessionRoomId = null;
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  playTile(roomId: string, tile: [number, number], side: 'left' | 'right'): void {
    this.socket?.emit('move', { room_id: roomId, tile, side });
  }

  draw(roomId: string): void {
    this.socket?.emit('draw', { room_id: roomId });
  }

  pass(roomId: string): void {
    this.socket?.emit('pass', { room_id: roomId });
  }

  onGameUpdate(cb: (state: unknown) => void): void {
    this.setOnGamePayload(cb);
  }
}
