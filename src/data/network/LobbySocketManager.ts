import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildSocketUrl } from '../../config/api.config';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';
import type { RoomResponse, RoomPlayer } from '../models/ApiModels';
import type { RoomStateResponse } from '../models/ApiModels';
import { normalizeRoomState } from './ApiService';

const NAMESPACE = '/rooms';
const SUBSCRIBE_RETRY_MS = 1_000;

function normalizeRoom(raw: any): RoomResponse {
  const players: RoomPlayer[] = (raw.players ?? []).map((p: any) => {
    const ref = p.playerId ?? p.user ?? p;
    return { id: ref._id ?? ref.id ?? '', username: ref.username ?? '' };
  });
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    players,
    betAmount: raw.bet_amount ?? 0,
    status: (raw.status ?? raw.roomStatus ?? raw.room_status ?? '').toLowerCase(),
    spectatorsCount: raw.spectatorsCount ?? raw.spectators_count ?? 0,
    gameId: raw.game_id?._id
      ? String(raw.game_id._id)
      : raw.game_id
        ? String(raw.game_id)
        : undefined,
    playerLimit: raw.player_limit ?? raw.playerLimit ?? raw.maxPlayers ?? 2,
  };
}

export class LobbySocketManager {
  private socket: Socket | null = null;
  private sessionGameId: string | null = null;
  private sessionRoomId: string | null = null;
  private onConnectCb?: () => void;
  private onRoomCreatedCb?: (room: RoomResponse) => void;
  private onRoomUpdatedCb?: (room: RoomResponse) => void;
  private onRoomStartedCb?: (room: RoomResponse) => void;
  private onRoomStateCb?: (state: RoomStateResponse) => void;
  private onRoomStateErrorCb?: (reason: 'invalid' | 'notFound') => void;
  private onRoomDeletedCb?: (roomId: string) => void;
  private subscribeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedGameId: string | null = null;

  private clearSubscribeRetry(): void {
    if (this.subscribeRetryTimer) clearTimeout(this.subscribeRetryTimer);
    this.subscribeRetryTimer = null;
  }

  private subscribeUntilAcknowledged(): void {
    const gameId = this.sessionGameId;
    if (!gameId || !this.socket?.connected || this.subscribedGameId === gameId) return;
    this.socket.emit('subscribe', {
      game_id: gameId,
      ...(this.sessionRoomId ? { room_id: this.sessionRoomId } : {}),
    });
    this.clearSubscribeRetry();
    this.subscribeRetryTimer = setTimeout(
      () => this.subscribeUntilAcknowledged(),
      SUBSCRIBE_RETRY_MS,
    );
  }

  connect(gameId: string, roomId?: string): void {
    this.disconnect();

    this.sessionGameId = gameId;
    this.sessionRoomId = roomId || null;
    this.subscribedGameId = null;

    this.socket = io(buildSocketUrl(NAMESPACE), {
      ...SOCKET_IO_CLIENT_DEFAULTS,
      auth: { appVersion: __APP_VERSION__ },
      query: { appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(),
    });

    attachVersionMismatchListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE, {
      onResync: () => {
        if (this.sessionGameId) {
          this.resubscribe(this.sessionGameId, this.sessionRoomId || undefined);
        } else if (this.sessionRoomId) {
          this.requestRoomState(this.sessionRoomId);
        }
      },
    });

    this.socket.on('connect', () => {
      if (gameId) {
        this.subscribedGameId = null;
        this.subscribeUntilAcknowledged();
      } else if (roomId) {
        this.requestRoomState(roomId);
      }
      this.onConnectCb?.();
    });

    this.socket.on('rooms', (raw: unknown) => {
      const envelope = raw as {
        success?: boolean;
        data?: { event?: string; game_id?: string; reason?: string };
      };
      if (
        envelope?.success === true &&
        envelope.data?.event === 'subscribed' &&
        String(envelope.data.game_id || '') === String(this.sessionGameId || '')
      ) {
        this.subscribedGameId = String(envelope.data.game_id);
        this.clearSubscribeRetry();
      }
      if (
        envelope?.success === false &&
        envelope.data?.event === 'roomStateError' &&
        (envelope.data.reason === 'invalid' || envelope.data.reason === 'notFound')
      ) {
        this.onRoomStateErrorCb?.(envelope.data.reason);
      }
    });
    this.socket.on('roomCreated', (raw: unknown) => this.onRoomCreatedCb?.(normalizeRoom(raw)));
    this.socket.on('roomUpdated', (raw: unknown) => this.onRoomUpdatedCb?.(normalizeRoom(raw)));
    this.socket.on('roomStarted', (raw: unknown) => this.onRoomStartedCb?.(normalizeRoom(raw)));
    this.socket.on('roomState', (raw: unknown) => this.onRoomStateCb?.(normalizeRoomState(raw)));
    this.socket.on('roomDeleted', (raw: unknown) => {
      const payload = raw as { id?: string } | string;
      const id = typeof payload === 'string' ? payload : (payload?.id ?? '');
      if (id) this.onRoomDeletedCb?.(id);
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

  resubscribe(gameId: string, roomId?: string): void {
    this.sessionGameId = gameId;
    this.sessionRoomId = roomId || null;
    this.subscribedGameId = null;
    this.subscribeUntilAcknowledged();
  }

  requestRoomState(roomId = this.sessionRoomId || ''): void {
    if (!roomId) return;
    this.socket?.emit('syncRoomState', { room_id: roomId });
  }

  disconnect(): void {
    this.clearSubscribeRetry();
    this.subscribedGameId = null;
    this.sessionGameId = null;
    this.sessionRoomId = null;
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  onConnect(cb: () => void): void {
    this.onConnectCb = cb;
  }

  onRoomCreated(cb: (room: RoomResponse) => void): void {
    this.onRoomCreatedCb = cb;
  }

  onRoomUpdated(cb: (room: RoomResponse) => void): void {
    this.onRoomUpdatedCb = cb;
  }

  onRoomStarted(cb: (room: RoomResponse) => void): void {
    this.onRoomStartedCb = cb;
  }

  onRoomState(cb: (state: RoomStateResponse) => void): void {
    this.onRoomStateCb = cb;
  }

  onRoomStateError(cb: (reason: 'invalid' | 'notFound') => void): void {
    this.onRoomStateErrorCb = cb;
  }

  onRoomDeleted(cb: (roomId: string) => void): void {
    this.onRoomDeletedCb = cb;
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
