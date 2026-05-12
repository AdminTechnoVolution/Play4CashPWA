import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import type { RoomResponse, RoomPlayer } from '../models/ApiModels';

const NAMESPACE = '/rooms';

// Normalize raw backend room payload (snake_case → camelCase RoomResponse)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  private onConnectCb?: () => void;

  connect(gameId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      transports: ['polling'],
      autoConnect: false,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      auth: { token, appVersion: __APP_VERSION__ },
      query: { token, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    // Phase D: register with global connection store.
    instrumentSocket(this.socket, NAMESPACE);

    this.socket.on('connect', () => {
      // Android: emit "subscribe" with game_id to receive room events for this game
      this.socket?.emit('subscribe', { game_id: gameId });
      this.onConnectCb?.();
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
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  onConnect(cb: () => void): void {
    this.onConnectCb = cb;
  }

  // Android: "roomCreated" → full Room JSON
  onRoomCreated(cb: (room: RoomResponse) => void): void {
    this.socket?.on('roomCreated', (raw: unknown) => cb(normalizeRoom(raw)));
  }

  // Android: "roomUpdated" → full Room JSON
  onRoomUpdated(cb: (room: RoomResponse) => void): void {
    this.socket?.on('roomUpdated', (raw: unknown) => cb(normalizeRoom(raw)));
  }

  // Android: "roomDeleted" → { "id": "<room_id>" }
  onRoomDeleted(cb: (roomId: string) => void): void {
    this.socket?.on('roomDeleted', (raw: unknown) => {
      const payload = raw as { id?: string } | string;
      const id = typeof payload === 'string' ? payload : (payload?.id ?? '');
      if (id) cb(id);
    });
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
