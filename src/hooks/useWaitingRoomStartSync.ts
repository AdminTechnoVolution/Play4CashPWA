import { useEffect, useSyncExternalStore } from 'react';
import { apiRepository } from '../data/network/ApiRepository';
import { useChessStore, ChessPhase } from '../store/chessStore';
import { useDominoStore, DominoPhase } from '../store/dominoStore';
import { useHalmaStore, HalmaPhase } from '../store/halmaStore';
import { useUnoStore, UnoPhase } from '../store/unoStore';
import { useConnectFourStore, ConnectFourPhase } from '../store/connectFourStore';
import { handleRoomGone, resyncActivePlaySession } from '../util/playRoomSession';

const POLL_INTERVAL_MS = 2_000;
const AUTO_START_GAMES = new Set(['chess', 'halma', 'domino', 'uno', 'connect-four']);

function subscribeGame(game: string, onChange: () => void): () => void {
  switch (game) {
    case 'chess': return useChessStore.subscribe(onChange);
    case 'halma': return useHalmaStore.subscribe(onChange);
    case 'domino': return useDominoStore.subscribe(onChange);
    case 'uno': return useUnoStore.subscribe(onChange);
    case 'connect-four': return useConnectFourStore.subscribe(onChange);
    default: return () => {};
  }
}

function isWaiting(game: string): boolean {
  switch (game) {
    case 'chess': return useChessStore.getState().phase === ChessPhase.WAITING;
    case 'halma': return useHalmaStore.getState().phase === HalmaPhase.WAITING;
    case 'domino': return useDominoStore.getState().phase === DominoPhase.WAITING;
    case 'uno': return useUnoStore.getState().phase === UnoPhase.WAITING;
    case 'connect-four': return useConnectFourStore.getState().phase === ConnectFourPhase.WAITING;
    default: return false;
  }
}

/**
 * Recovers a missed game-start event and, crucially, confirms the local player is ready
 * when the room becomes full. The latter is independent of the game socket because the
 * creator can miss the transient `opponentJoined` websocket event.
 */
export function useWaitingRoomStartSync(
  gameSocketCode: string,
  roomId: string,
  isSpectator: boolean,
): void {
  const automaticGame = AUTO_START_GAMES.has(gameSocketCode);
  const waiting = useSyncExternalStore(
    (onChange) => (automaticGame ? subscribeGame(gameSocketCode, onChange) : () => {}),
    () => automaticGame && isWaiting(gameSocketCode),
    () => false,
  );

  useEffect(() => {
    if (!roomId || isSpectator || (automaticGame && !waiting)) return;
    let cancelled = false;
    let inFlight = false;
    let interval: number | undefined;

    const tick = async () => {
      if (cancelled || inFlight || (automaticGame && !isWaiting(gameSocketCode))) return;
      inFlight = true;
      try {
        const status = await apiRepository.getRoomStatus(roomId);
        if (cancelled) return;
        const roomStatus = status.status?.toLowerCase();
        const requiredPlayers = status.playerLimit ?? 2;

        // Do not rely solely on `opponentJoined`: that event is not replayed after a
        // socket reconnect, leaving P1 permanently false while P2 is already ready.
        if (roomStatus === 'waiting' && status.playerCount >= requiredPlayers) {
          // Idempotent best effort. A transient PATCH failure must not be treated as
          // a deleted room; the next tick retries while Mongo remains authoritative.
          await apiRepository.roomReady(roomId).catch(() => undefined);
        }

        if (automaticGame && roomStatus === 'started') {
          await resyncActivePlaySession();
        } else if (!automaticGame && roomStatus === 'started') {
          window.clearInterval(interval);
        } else if (roomStatus === 'finished') {
          handleRoomGone({ reason: 'cancelled', gameSocketCode, roomId });
        }
      } catch {
        // Network/auth/proxy interruptions are recoverable. Visibility reconnect and
        // the next status tick retry; only an explicit terminal status exits play.
      } finally {
        inFlight = false;
      }
    };

    void tick();
    interval = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [automaticGame, gameSocketCode, isSpectator, roomId, waiting]);
}
