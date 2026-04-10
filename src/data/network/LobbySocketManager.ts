import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import type { ApiResponse, LoginResponse, RoomResponse, RoomPlayer } from '../models/ApiModels';

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
    socket.auth = { token: newToken };
    (socket.io.opts as Record<string, unknown>).query = { token: newToken };
    (socket.io.opts as Record<string, unknown>).extraHeaders = socketIoExtraHeaders(newToken);
  })().finally(() => { socketRefreshPromise = null; });

  return socketRefreshPromise;
}

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

    this.socket = io(`${BASE_URL}/rooms`, {
      transports: ['polling'],
      autoConnect: false,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      auth: { token },
      query: { token },
      extraHeaders: socketIoExtraHeaders(token),
    });

    this.socket.on('connect', () => {
      // Android: emit "subscribe" with game_id to receive room events for this game
      this.socket?.emit('subscribe', { game_id: gameId });
      this.onConnectCb?.();
    });

    this.socket.on('connect_error', async (err: Error) => {
      const status = (err as unknown as { data?: { status?: number } }).data?.status;
      if (status === 401 && this.socket) {
        try {
          await refreshSocketToken(this.socket);
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
