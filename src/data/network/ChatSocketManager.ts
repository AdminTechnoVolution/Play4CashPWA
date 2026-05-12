import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders, acceptLanguageTag } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import type { ChatMessage } from '../models/ApiModels';
import { parseChatEnvelope } from '../../util/ChatGreetingModels';

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

    const lang = acceptLanguageTag();
    this.socket = io(`${BASE_URL}/chat`, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      forceNew: true,
      query: { token, lang, appVersion: __APP_VERSION__ },
      auth: { token, lang, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);

    this.socket.on('connect', () => {
      this.socket?.emit('join', { room_id: roomId, lang: acceptLanguageTag() });
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

  /** Android: JSONObject room_id + greeting_id — lang for server-side translation */
  sendGreeting(roomId: string, greetingId: string): void {
    if (!greetingId?.trim()) return;
    this.socket?.emit('greeting', {
      room_id: roomId,
      greeting_id: greetingId,
      lang: acceptLanguageTag(),
    });
  }

  /** Legacy: Domino/Halma — normalized line for last-message display */
  onMessage(cb: (msg: ChatMessage) => void): void {
    this.legacyMessageCb = cb;
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
