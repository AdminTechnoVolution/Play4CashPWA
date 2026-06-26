import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildSocketUrl } from '../../config/api.config';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { attachGameResultListener } from '../../util/playRoomSession';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';
import { clearSocketResyncThrottle, emitSocketResync } from './socketResync';
import type { UnoColor } from '../models/ApiModels';

const NAMESPACE = '/uno';

export class UnoSocketManager {
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

    this.socket = io(buildSocketUrl(NAMESPACE), {
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

    this.socket.on('uno', (payload: unknown) => {
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
    clearSocketResyncThrottle(NAMESPACE);
    releaseSocket(NAMESPACE);
  }

  requestSync(roomId: string): void {
    emitSocketResync(this.socket, NAMESPACE, roomId);
  }

  playCard(
    roomId: string,
    cardIndex: number,
    opts?: { chosenColor?: UnoColor; callUno?: boolean },
  ): void {
    const payload: Record<string, unknown> = { room_id: roomId, card_index: cardIndex };
    if (opts?.chosenColor) payload.chosen_color = opts.chosenColor;
    if (opts?.callUno) payload.call_uno = true;
    this.socket?.emit('play_card', payload);
  }

  drawCard(roomId: string): void {
    this.socket?.emit('draw_one', { room_id: roomId });
  }

  passTurn(roomId: string): void {
    this.socket?.emit('pass', { room_id: roomId });
  }

  takeDrawStack(roomId: string): void {
    this.socket?.emit('take_draw_stack', { room_id: roomId });
  }

  callUno(roomId: string): void {
    this.socket?.emit('call_uno', { room_id: roomId });
  }

  challengeUnoMiss(roomId: string, offenderId: string): void {
    this.socket?.emit('challenge_uno_miss', { room_id: roomId, offender_id: offenderId });
  }

  startNextRound(roomId: string): void {
    this.socket?.emit('start_next_round', { room_id: roomId });
  }
}
