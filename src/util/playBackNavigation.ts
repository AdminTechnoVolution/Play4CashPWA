import { apiRepository } from '../data/network/ApiRepository';
import { useBattleshipStore } from '../store/battleshipStore';
import { useChessStore } from '../store/chessStore';
import { useConnectFourStore } from '../store/connectFourStore';
import { useDominoStore } from '../store/dominoStore';
import { useHalmaStore } from '../store/halmaStore';
import { useUnoStore } from '../store/unoStore';
import { clearPlayContext } from './routingStorage';

type PlayBackConsumer = () => boolean;

const consumers: PlayBackConsumer[] = [];

let playSessionTearingDown = false;
const teardownListeners = new Set<() => void>();

function notifyTeardownListeners() {
  teardownListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** Hide /play UI immediately — before store cleanup or navigation. */
export function beginPlaySessionTeardown(): void {
  if (playSessionTearingDown) return;
  playSessionTearingDown = true;
  notifyTeardownListeners();
}

export function isPlaySessionTearingDown(): boolean {
  return playSessionTearingDown;
}

export function resetPlaySessionTeardown(): void {
  if (!playSessionTearingDown) return;
  playSessionTearingDown = false;
  notifyTeardownListeners();
}

export function subscribePlaySessionTeardown(onStoreChange: () => void): () => void {
  teardownListeners.add(onStoreChange);
  return () => {
    teardownListeners.delete(onStoreChange);
  };
}

function cleanupActivePlayStore(gameSocketCode: string): void {
  switch (gameSocketCode) {
    case 'chess':
      useChessStore.getState().cleanup();
      break;
    case 'domino':
      useDominoStore.getState().cleanup();
      break;
    case 'halma':
      useHalmaStore.getState().cleanup();
      break;
    case 'uno':
      useUnoStore.getState().cleanup();
      break;
    case 'connect-four':
      useConnectFourStore.getState().cleanup();
      break;
    default:
      useBattleshipStore.getState().cleanup();
      break;
  }
}

/** Disconnect sockets, reset store, clear play context. Call {@link beginPlaySessionTeardown} first. */
export function teardownPlaySession(gameSocketCode: string, roomId?: string): void {
  if (roomId) {
    void apiRepository.leaveRoom(roomId).catch(() => {});
  }
  if (gameSocketCode) {
    cleanupActivePlayStore(gameSocketCode);
  }
  clearPlayContext();
}

/** @deprecated Use {@link teardownPlaySession} after {@link beginPlaySessionTeardown}. */
export function teardownPlaySessionForTournamentExit(gameSocketCode: string, roomId?: string): void {
  beginPlaySessionTeardown();
  teardownPlaySession(gameSocketCode, roomId);
}

export function gameSocketCodeFromPlayPath(pathname = window.location.pathname): string {
  const m = pathname.match(/^\/play\/([^/?#]+)/);
  return m?.[1] ?? '';
}

export function registerPlayBackConsumer(fn: PlayBackConsumer): () => void {
  consumers.push(fn);
  return () => {
    const i = consumers.lastIndexOf(fn);
    if (i >= 0) consumers.splice(i, 1);
  };
}

/** @returns true if a child screen handled back (e.g. closed a modal). */
export function tryConsumePlayBack(): boolean {
  for (let i = consumers.length - 1; i >= 0; i--) {
    try {
      if (consumers[i]()) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** History state key for the synthetic entry that lets the first OS/gesture "back" stay on /play. */
export const PLAY_BACK_TRAP_KEY = 'play4cashBackTrap';

/** After play context is cleared, pop the trap entry (if any) then navigate back once. */
export function consumePlayBackTrapThenNavigate(navigateBack: () => void): void {
  if ((window.history.state as Record<string, unknown> | null)?.[PLAY_BACK_TRAP_KEY]) {
    window.history.go(-1);
    setTimeout(navigateBack, 0);
  } else {
    navigateBack();
  }
}
