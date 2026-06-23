import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL } from '../../config/api.config';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { attachGameResultListener } from '../../util/playRoomSession';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';
import type { HalmaState } from '../models/ApiModels';

const NAMESPACE = '/halma';

export class HalmaSocketManager {
  private socket: Socket | null = null;
  private sessionRoomId: string | null = null;
  private gameUpdateCb?: (data: HalmaState) => void;

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
    this.sessionRoomId = null;
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

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
