import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL } from '../../config/api.config';
import { socketIoExtraHeaders, acceptLanguageTag } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';
import type { ChatMessage } from '../models/ApiModels';
import { parseChatEnvelope } from '../../util/ChatGreetingModels';

const NAMESPACE = '/chat';

export class ChatSocketManager {
  private socket: Socket | null = null;
  private sessionRoomId: string | null = null;

  onChatEnvelope: ((json: any) => void) | null = null;
  private legacyMessageCb: ((msg: ChatMessage) => void) | null = null;

  connect(roomId: string): void {
    this.disconnect();


    const lang = acceptLanguageTag();
    this.sessionRoomId = roomId;

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      ...SOCKET_IO_CLIENT_DEFAULTS,
      query: { lang, appVersion: __APP_VERSION__ },
      auth: { lang, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(),
    });

    attachVersionMismatchListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE, {
      onResync: () => {
        if (this.sessionRoomId) this.requestSync(this.sessionRoomId);
      },
    });

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

  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId, lang: acceptLanguageTag() });
  }

  disconnect(): void {
    this.sessionRoomId = null;
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  sendGreeting(roomId: string, greetingId: string): void {
    if (!greetingId?.trim()) return;
    this.socket?.emit('greeting', {
      room_id: roomId,
      greeting_id: greetingId,
      lang: acceptLanguageTag(),
    });
  }

  onMessage(cb: (msg: ChatMessage) => void): void {
    this.legacyMessageCb = cb;
  }

  offAll(): void {
    this.socket?.removeAllListeners();
  }
}
