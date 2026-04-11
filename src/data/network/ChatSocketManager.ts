import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken, getRefreshToken, saveTokens } from '../auth/AuthSessionStore';
import { bareClient } from './ApiClient';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import type { ApiResponse, LoginResponse, ChatMessage } from '../models/ApiModels';
import { parseChatEnvelope } from '../../util/ChatGreetingModels';

let socketRefreshPromise: Promise<void> | null = null;

async function refreshSocketToken(socket: Socket): Promise<void> {
  if (socketRefreshPromise) {
    return socketRefreshPromise;
  }

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
    (socket.io.opts as Record<string, unknown>).auth = { token: newToken };
  })().finally(() => {
    socketRefreshPromise = null;
  });

  return socketRefreshPromise;
}

/**
 * Android ChatSocketManager.kt — namespace `/chat`, handshake auth token + accept-language.
 * Events: listen `chat` (full envelope); emit `join`, `greeting`.
 */
export class ChatSocketManager {
  private socket: Socket | null = null;

  /** Android: onChatEnvelope — raw JSON envelope (same shape as REST ApiResponse). */
  onChatEnvelope: ((json: any) => void) | null = null;

  private legacyMessageCb: ((msg: ChatMessage) => void) | null = null;

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}/chat`, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      forceNew: true,
      query: { token },
      auth: { token },
      extraHeaders: socketIoExtraHeaders(token),
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join', { room_id: roomId });
    });

    this.socket.on('connect_error', async (err: Error & { data?: { status?: number } }) => {
      const msg = err?.message || '';
      const status = (err as unknown as { data?: { status?: number } }).data?.status;
      if (
        (status === 401 || msg.includes('401') || msg.toLowerCase().includes('unauthorized')) &&
        this.socket
      ) {
        try {
          await refreshSocketToken(this.socket);
          this.socket.connect();
        } catch {
          window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
        }
      }
    });

    this.socket.on('chat', (raw: any) => {
      let payload = raw;
      if (typeof raw === 'string') {
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }
      }
      this.onChatEnvelope?.(payload);
      // Only surface greeting lines in the chips preview — ignore system/room events (no `from` → was shown as "System:").
      if (this.legacyMessageCb) {
        const ev = parseChatEnvelope(payload);
        const data = payload?.data ?? payload;
        const ts =
          data && typeof data === 'object' && (data as { timestamp?: number }).timestamp
            ? Number((data as { timestamp?: number }).timestamp)
            : Date.now();
        if (ev.type === 'Incoming') {
          this.legacyMessageCb({
            from: ev.from || (data as { userName?: string }).userName || (data as { user_name?: string }).user_name || '',
            text: ev.text,
            timestamp: ts,
          });
        } else if (ev.type === 'Sent') {
          this.legacyMessageCb({
            from: '',
            text: ev.text,
            timestamp: ts,
          });
        }
      }
    });

    this.socket.connect();
  }

  disconnect(): void {
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Android: JSONObject room_id + greeting_id */
  sendGreeting(roomId: string, greetingId: string): void {
    if (!greetingId?.trim()) return;
    this.socket?.emit('greeting', { room_id: roomId, greeting_id: greetingId });
  }

  /** Legacy: Domino/Halma — normalized line for last-message display */
  onMessage(cb: (msg: ChatMessage) => void): void {
    this.legacyMessageCb = cb;
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
