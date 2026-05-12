import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { BASE_URL, SOCKET_TIMEOUT_MS } from '../../config/api.config';
import { getAccessToken } from '../auth/AuthSessionStore';
import { socketIoExtraHeaders } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import type { UnoColor } from '../models/ApiModels';

const NAMESPACE = '/uno';

/**
 * Socket.IO client for the `/uno` namespace. Mirrors `DominoSocketManager` shape so the
 * lifecycle (connect → join → payload → disconnect) matches every other game and the
 * gateway/auth-refresh wiring is identical.
 *
 * Server emits the `uno` event for every state change (success or failure). Outgoing
 * events: `join`, `play_card`, `draw_card`, `pass_turn`, `take_draw_stack`, `call_uno`,
 * `challenge_uno_miss`.
 */
export class UnoSocketManager {
  private socket: Socket | null = null;
  private onPayload?: (raw: unknown) => void;
  private onConnectedCb?: () => void;

  setOnGamePayload(cb: (raw: unknown) => void): void {
    this.onPayload = cb;
  }

  setOnConnected(cb: () => void): void {
    this.onConnectedCb = cb;
  }

  connect(roomId: string): void {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(new CustomEvent('p4c:auth-failure'));
      return;
    }

    this.socket = io(`${BASE_URL}${NAMESPACE}`, {
      transports: ['polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: SOCKET_TIMEOUT_MS,
      query: { token, appVersion: __APP_VERSION__ },
      auth: { token, appVersion: __APP_VERSION__ },
      extraHeaders: socketIoExtraHeaders(token),
    });

    attachVersionMismatchListener(this.socket);
    // Phase D: register with the global connection store so <ReconnectionBanner />
    // and `useVisibilityReconnect` can react to transport flaps.
    instrumentSocket(this.socket, NAMESPACE);

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
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }

  /** Re-emit join to resync state (used after polling sees room.status === 'started'). */
  requestSync(roomId: string): void {
    this.socket?.emit('join', { room_id: roomId });
  }

  /**
   * Plays a card. Pass `callUno: true` atomically when this card will leave you at 1
   * card so you don't open a challenge window on yourself. `chosenColor` is required
   * for Wild ('W') and Wild +4 ('W4').
   */
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
    this.socket?.emit('draw_card', { room_id: roomId });
  }

  passTurn(roomId: string): void {
    this.socket?.emit('pass_turn', { room_id: roomId });
  }

  takeDrawStack(roomId: string): void {
    this.socket?.emit('take_draw_stack', { room_id: roomId });
  }

  /** Reactive UNO declaration when you forgot to set `call_uno` on the play. Only
   *  succeeds while the server still has `pendingUnoOffender === self`. */
  callUno(roomId: string): void {
    this.socket?.emit('call_uno', { room_id: roomId });
  }

  /** Accuse another player of failing to declare UNO. Server validates the window. */
  challengeUnoMiss(roomId: string, offenderId: string): void {
    this.socket?.emit('challenge_uno_miss', { room_id: roomId, offender_id: offenderId });
  }

  /**
   * Tap "ready" on the between-rounds scoreboard. The server skips the auto-start
   * countdown when every active player has signalled ready.
   */
  startNextRound(roomId: string): void {
    this.socket?.emit('start_next_round', { room_id: roomId });
  }
}
