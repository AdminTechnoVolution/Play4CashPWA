import { useEffect, useSyncExternalStore } from 'react';
import { apiRepository } from '../data/network/ApiRepository';
import { useChessStore, ChessPhase } from '../store/chessStore';
import { useDominoStore, DominoPhase } from '../store/dominoStore';
import { useHalmaStore, HalmaPhase } from '../store/halmaStore';
import { useUnoStore, UnoPhase } from '../store/unoStore';
import { useConnectFourStore, ConnectFourPhase } from '../store/connectFourStore';
import { handleRoomGone, resyncActivePlaySession } from '../util/playRoomSession';
import { LobbySocketManager } from '../data/network/LobbySocketManager';
import { getGameContext, getPlayContext, savePlayContext } from '../util/routingStorage';
import { useAuthStore } from '../store/authStore';
import type { RoomStateResponse } from '../data/models/ApiModels';

const AUTO_START_GAMES = new Set(['chess', 'halma', 'domino', 'uno', 'connect-four']);
const WAITING_ROOM_HTTP_POLL_MS = 10_000;

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
    const lobbySocket = new LobbySocketManager();
    let processing = Promise.resolve();
    let httpPollInFlight = false;

    const processState = async (status: RoomStateResponse) => {
      if (
        cancelled ||
        status.roomId !== roomId ||
        (automaticGame && !isWaiting(gameSocketCode))
      ) return;
      try {
        const roomStatus = status.status?.toLowerCase();
        const requiredPlayers = status.requiredPlayers ?? 2;

        if (!status.isCurrentUserInRoom) {
          handleRoomGone({ reason: 'inactive', gameSocketCode, roomId });
          return;
        }

        // Do not rely solely on `opponentJoined`: that event is not replayed after a
        // socket reconnect, leaving P1 permanently false while P2 is already ready.
        if (
          (roomStatus === 'waiting' || roomStatus === 'started') &&
          status.currentPlayers >= requiredPlayers
        ) {
          // Idempotent best effort. A transient PATCH failure must not be treated as
          // a deleted room; the next tick retries while Mongo remains authoritative.
          await apiRepository.roomReady(roomId).catch(() => undefined);
        }

        if (roomStatus === 'started' && status.canEnterPlay) {
          const current = getPlayContext();
          if (current) {
            const currentUserId = useAuthStore.getState().user?.id;
            const opponent = status.players.find(
              (player) => !currentUserId || player.id !== currentUserId,
            );
            savePlayContext({
              ...current,
              opponentName: opponent?.username || current.opponentName,
              hasOpponent: status.currentPlayers > 1,
            });
          }
        }

        if (automaticGame && roomStatus === 'started' && status.canEnterPlay) {
          await resyncActivePlaySession();
        } else if (roomStatus === 'finished') {
          handleRoomGone({ reason: 'cancelled', gameSocketCode, roomId });
        }
      } catch {
        // A later authoritative roomState event retries transient local work.
      }
    };

    const enqueueState = (state: RoomStateResponse) => {
      processing = processing.then(() => processState(state));
    };
    const pollStateOverHttp = async () => {
      if (
        cancelled ||
        httpPollInFlight ||
        (automaticGame && !isWaiting(gameSocketCode))
      ) return;

      httpPollInFlight = true;
      try {
        enqueueState(await apiRepository.getRoomState(roomId));
      } catch {
        // WebSocket remains authoritative; retry transient HTTP failures next tick.
      } finally {
        httpPollInFlight = false;
      }
    };
    const requestState = () => lobbySocket.requestRoomState(roomId);
    const gameId = getGameContext()?.gameId || '';

    lobbySocket.connect(gameId, roomId);
    lobbySocket.onRoomState(enqueueState);
    lobbySocket.onRoomStateError((reason) => {
      handleRoomGone({ reason, gameSocketCode, roomId });
    });
    lobbySocket.onRoomUpdated((room) => {
      if (room.id === roomId) requestState();
    });
    lobbySocket.onRoomStarted((room) => {
      if (room.id === roomId) requestState();
    });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestState();
    };
    const onSocketResync = (event: Event) => {
      const namespace = (event as CustomEvent<{ namespace?: string }>).detail?.namespace;
      if (!namespace || namespace === '/rooms') requestState();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('p4c:socket-resync', onSocketResync);
    const httpPollTimer = automaticGame
      ? window.setInterval(
          () => void pollStateOverHttp(),
          WAITING_ROOM_HTTP_POLL_MS,
        )
      : undefined;
    return () => {
      cancelled = true;
      if (httpPollTimer !== undefined) window.clearInterval(httpPollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('p4c:socket-resync', onSocketResync);
      lobbySocket.offAll();
      lobbySocket.disconnect();
    };
  }, [automaticGame, gameSocketCode, isSpectator, roomId, waiting]);
}
