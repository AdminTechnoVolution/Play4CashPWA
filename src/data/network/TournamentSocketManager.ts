/**
 * Tournament lobby socket — namespace /tournaments
 */
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { buildSocketUrl } from '../../config/api.config';
import { socketIoExtraHeaders, acceptLanguageTag } from './socketExtraHeaders';
import { isSocketUnauthorizedConnectError, refreshSocketHandshake } from './socketSessionRefresh';
import { attachVersionMismatchListener } from './socketVersionListener';
import { instrumentSocket, releaseSocket } from './socketRegistry';
import { SOCKET_IO_CLIENT_DEFAULTS } from './socketClientDefaults';

const NAMESPACE = '/tournaments';
const EVENT = 'tournament';

export class TournamentSocketManager {
  private socket: Socket | null = null;
  private sessionTournamentId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private onPayload?: (raw: unknown) => void;
  private onProxyReconnectedCb?: () => void;

  setOnPayload(cb: (raw: unknown) => void): void {
    this.onPayload = cb;
  }

  setOnProxyReconnected(cb: () => void): void {
    this.onProxyReconnectedCb = cb;
  }

  connect(tournamentId: string): void {
    this.disconnect();
    const lang = acceptLanguageTag();
    this.sessionTournamentId = tournamentId;

    this.socket = io(buildSocketUrl(NAMESPACE), {
      ...SOCKET_IO_CLIENT_DEFAULTS,
      query: { appVersion: __APP_VERSION__, lang },
      auth: { appVersion: __APP_VERSION__, lang },
      extraHeaders: socketIoExtraHeaders(),
    });
    attachVersionMismatchListener(this.socket);
    instrumentSocket(this.socket, NAMESPACE, {
      onResync: () => {
        if (this.sessionTournamentId) {
          this.socket?.emit('tournament:join', { tournament_id: this.sessionTournamentId });
          this.requestState();
          this.onProxyReconnectedCb?.();
        }
      },
    });

    this.socket.on('connect', () => {
      this.socket?.emit('tournament:join', { tournament_id: tournamentId });
      this.startHeartbeat();
    });
    this.socket.on(EVENT, (payload: unknown) => this.onPayload?.(payload));
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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.socket?.emit('tournament:heartbeat', {});
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  requestState(): void {
    this.socket?.emit('tournament:getState', {});
  }

  disconnect(): void {
    this.sessionTournamentId = null;
    this.stopHeartbeat();
    this.socket?.off();
    this.socket?.disconnect();
    this.socket = null;
    releaseSocket(NAMESPACE);
  }
}
