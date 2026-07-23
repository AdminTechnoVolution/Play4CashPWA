import { reconnectAllStaleSockets } from '../data/network/socketRegistry';
import type { Socket } from 'socket.io-client';
import { useBattleshipStore } from '../store/battleshipStore';
import { useDominoStore } from '../store/dominoStore';
import { useUnoStore } from '../store/unoStore';
import { getPlayContext } from './routingStorage';
import {
  beginPlaySessionTeardown,
  consumePlayBackTrapThenNavigate,
  gameSocketCodeFromPlayPath,
  teardownPlaySession,
} from './playBackNavigation';
import { rawLineToMessageKey } from '../i18n/ApiMessageDisplay';

export type RoomGoneReason =
  | 'deleted'
  | 'notFound'
  | 'inactive'
  | 'invalid'
  | 'cancelled'
  | 'visibility';

export type HandleRoomGoneOptions = {
  reason: RoomGoneReason;
  gameSocketCode?: string;
  roomId?: string;
};

let gameEndInProgress = false;
let suppressRoomNotFound = false;

type RoomGoneNavigator = (path: string, replace?: boolean) => void;
let roomGoneNavigator: RoomGoneNavigator | null = null;

/** PlayPage registers React Router navigate for central room-gone exits. */
export function registerRoomGoneNavigator(navigate: RoomGoneNavigator): () => void {
  roomGoneNavigator = navigate;
  return () => {
    if (roomGoneNavigator === navigate) roomGoneNavigator = null;
  };
}

export function setGameEndInProgress(value: boolean): void {
  gameEndInProgress = value;
  suppressRoomNotFound = value;
}

export function isGameEndInProgress(): boolean {
  return gameEndInProgress;
}

export function shouldSuppressRoomNotFound(): boolean {
  return suppressRoomNotFound || gameEndInProgress;
}

export function resetPlayRoomSessionFlags(): void {
  gameEndInProgress = false;
  suppressRoomNotFound = false;
}

/** Gateway Bug B: `result` with `roomCloseReason: gameFinished` arrives before terminal game payload. */
export function markGameEndFromResultEnvelope(envelope: unknown): void {
  if (!envelope || typeof envelope !== 'object') return;
  const reason = (envelope as Record<string, unknown>).roomCloseReason;
  if (reason === 'gameFinished') {
    setGameEndInProgress(true);
  }
}

export function attachGameResultListener(socket: Socket): void {
  socket.on('result', (envelope: unknown) => {
    markGameEndFromResultEnvelope(envelope);
  });
}

const ROOM_GONE_MESSAGE_KEYS = new Set([
  'ws.games.gameNotFound',
  'ws.games.roomInactive',
  'ws.games.notInRoom',
  'room_finished',
]);

/** True when a socket/API line means the play room no longer exists for this user. */
export function isRoomGoneMessageRaw(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return false;
  const lines = String(raw)
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.some((line) => {
    const key = rawLineToMessageKey(line);
    return key != null && ROOM_GONE_MESSAGE_KEYS.has(key);
  });
}

/** Teardown sockets/store and clear play context (Android `clearRoomState`). */
export function clearRoomState(gameSocketCode: string, roomId?: string): void {
  teardownPlaySession(gameSocketCode, roomId);
}

/**
 * Central handler when the room is gone (deleted, 404, inactive, post-lock invalid).
 * Skips error UI while a game-end modal is showing; redirects to lobby without money modal.
 */
export function handleRoomGone(opts: HandleRoomGoneOptions): void {
  if (
    shouldSuppressRoomNotFound() &&
    (opts.reason === 'notFound' || opts.reason === 'inactive' || opts.reason === 'deleted')
  ) {
    return;
  }

  const gameSocketCode = opts.gameSocketCode ?? gameSocketCodeFromPlayPath();
  const roomId = opts.roomId ?? getPlayContext()?.roomId;
  const dest = gameSocketCode
    ? `/rooms/${encodeURIComponent(gameSocketCode)}`
    : '/dashboard';

  beginPlaySessionTeardown();
  if (gameSocketCode) {
    clearRoomState(gameSocketCode, roomId);
  } else {
    clearRoomState('', roomId);
  }

  const navigate = roomGoneNavigator;
  if (!navigate) return;

  consumePlayBackTrapThenNavigate(() => {
    navigate(dest, true);
  });
}

function requestSyncOnActiveGameSocket(gameSocketCode: string, roomId: string): void {
  switch (gameSocketCode) {
    case 'chess':
      (window as unknown as { chessSocket?: { requestSync: (id: string) => void } }).chessSocket
        ?.requestSync(roomId);
      break;
    case 'domino':
      useDominoStore.getState().socket?.requestSync(roomId);
      break;
    case 'halma':
      (window as unknown as { halmaSocket?: { requestSync: (id: string) => void } }).halmaSocket
        ?.requestSync(roomId);
      break;
    case 'uno':
      useUnoStore.getState().socket?.requestSync(roomId);
      break;
    case 'connect-four':
      (window as unknown as { connectFourSocket?: { requestSync: (id: string) => void } })
        .connectFourSocket?.requestSync(roomId);
      break;
    default:
      useBattleshipStore.getState().socket?.requestSync(roomId);
      break;
  }
}

/**
 * After tab wake / bfcache: reconnect transports, re-join/sync active play room,
 * redirect home if the room is invalid (no forfeit/money modal).
 */
export async function resyncActivePlaySession(): Promise<void> {
  reconnectAllStaleSockets();

  const playCtx = getPlayContext();
  const gameSocketCode = gameSocketCodeFromPlayPath();
  if (!playCtx?.roomId || !gameSocketCode) return;
  if (isGameEndInProgress()) return;

  requestSyncOnActiveGameSocket(gameSocketCode, playCtx.roomId);
}
