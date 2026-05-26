import { create } from 'zustand';
import { DominoSocketManager } from '../data/network/DominoSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { DominoTile, GameOverPayload, GreetingResponse } from '../data/models/ApiModels';
import { SpectatorPayload } from '../util/SpectatorPayload';
import {
  apiMessagesJoinedOrNull,
  applyWsMessagePlaceholders,
  formatApiMessagesBlockForDisplay,
  gameEndMessageForDisplay,
  isInformationalNonBlockingSocketRaw,
} from '../i18n/ApiMessageDisplay';
import { hasKey, t } from '../i18n/translations';
import { parseChatEnvelope, type ChatGreetingOverlay } from '../util/ChatGreetingModels';
import {
  buildDominoGameOverPayload,
  computeBoneyardInvariant,
  computeValidMovesClient,
  dominoLastTileFromHistory,
  opponentsFromHandCount,
  parseBoardArray,
  parseHandArray,
  parseLobbyJoinedCount,
  parseLobbyRequiredCount,
  sumOpponentHandCounts,
} from '../pages/play/domino/dominoGameLogic';
import {
  applyIncomingStateVersion,
  createStateVersionTracker,
  resetStateVersionTracker,
} from '../data/network/socketStateVersion';
import { canAcceptWaitingLobby } from '../util/playPhaseGuards';
import { thresholdSeconds, triggerTimeoutWarning } from '../ui/game/turnTimeoutAlarm';

let dominoActiveRoomId: string | null = null;
const dominoStateVersionTracker = createStateVersionTracker(() => {
  if (dominoActiveRoomId) (window as any).dominoSocket?.requestSync(dominoActiveRoomId);
});

export enum DominoPhase {
  WAITING = 'WAITING',
  PLAY = 'PLAY',
  GAME_OVER = 'GAME_OVER',
}

let chatOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;
let dominoTurnTimer: ReturnType<typeof setInterval> | null = null;
let dominoTimeoutWarned = false;
let lastGreetingSentAtMs = 0;

function stopDominoTurnTimer() {
  if (dominoTurnTimer) {
    clearInterval(dominoTurnTimer);
    dominoTurnTimer = null;
  }
}

/** Local 1s countdown + TurnTimeoutAlarm (Android DominoViewModel) for non-spectators */
function syncDominoTurnCountdownAfterSocket(set: (partial: any) => void, get: () => DominoStore) {
  stopDominoTurnTimer();
  const st = get();
  if (st.phase !== DominoPhase.PLAY || st.turnTimeLeft <= 0 || st.isSpectator) return;

  dominoTimeoutWarned = false;
  const cap = st.turnTimerTotal > 0 ? st.turnTimerTotal : st.turnTimeLeft;

  queueMicrotask(() => {
    const s = get();
    if (!s.isPlayerTurn || s.isSpectator) return;
    const th = thresholdSeconds(cap);
    if (cap > 0 && cap <= th && !dominoTimeoutWarned) {
      triggerTimeoutWarning();
      dominoTimeoutWarned = true;
    }
  });

  dominoTurnTimer = setInterval(() => {
    set((s: DominoStoreState) => {
      if (s.phase !== DominoPhase.PLAY) return s;
      const prev = s.turnTimeLeft;
      if (prev <= 0) {
        stopDominoTurnTimer();
        return s;
      }
      const next = Math.max(0, prev - 1);
      const capUse = s.turnTimerTotal > 0 ? s.turnTimerTotal : prev;
      if (s.isPlayerTurn && !s.isSpectator && !dominoTimeoutWarned) {
        const th = thresholdSeconds(capUse);
        if (capUse > th && prev > th && next <= th) {
          triggerTimeoutWarning();
          dominoTimeoutWarned = true;
        }
      }
      if (next === 0) stopDominoTurnTimer();
      return { turnTimeLeft: next };
    });
  }, 1000);
}

function scheduleChatOverlay(set: (partial: any) => void, overlay: ChatGreetingOverlay) {
  if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
  set({ chatGreetingOverlay: overlay });
  chatOverlayTimeout = setTimeout(() => {
    set({ chatGreetingOverlay: null });
    chatOverlayTimeout = null;
  }, 3000);
}

function formatThreePlaceholders(msg: string, a: number, b: number, c: number): string {
  return msg.replace('%1$d', String(a)).replace('%2$d', String(b)).replace('%3$d', String(c));
}

function formatPlayerLeftCounts(msg: string, player: string, rem: number, req: number): string {
  return msg.replace('%1$s', player).replace('%2$d', String(rem)).replace('%3$d', String(req));
}

function dominoWaitingMainMessage(data: any): string {
  const required = parseLobbyRequiredCount(data);
  const joined = parseLobbyJoinedCount(data);
  if (required != null && required > 2) return 'domino_status_waiting_table';
  if (joined != null && joined > 1) return 'domino_status_waiting_table';
  return 'domino_status_waiting_opponent';
}

function buildDominoWaitingLobbySubtitle(json: any, data: any): string {
  const joined = parseLobbyJoinedCount(data);
  const required = parseLobbyRequiredCount(data);
  const countPart =
    joined != null && required != null
      ? formatThreePlaceholders(t('domino_waiting_lobby_players'), joined, required, Math.max(0, required - joined))
      : null;
  const rawApi = apiMessagesJoinedOrNull(json)?.trim() || '';
  // Server often sends English in messages[]; map literals → keys (ApiMessageDisplay) so UI matches app language
  const apiPart = rawApi ? formatApiMessagesBlockForDisplay(rawApi, '') : '';
  const onlyGenericWait =
    !!apiPart &&
    (apiPart.trim() === t('domino_status_waiting_opponent').trim() ||
      apiPart.trim() === t('ws.games.waitingOpponent').trim() ||
      apiPart.trim() === t('domino_status_waiting_table').trim());
  if (countPart && apiPart && !onlyGenericWait && countPart !== apiPart) return `${countPart}\n${apiPart}`;
  if (countPart) return countPart;
  if (apiPart) return apiPart;
  return '';
}

function tilesEqual(t: DominoTile, u: DominoTile): boolean {
  return (t.a === u.a && t.b === u.b) || (t.a === u.b && t.b === u.a);
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function startStatusPolling(roomId: string, get: () => DominoStore) {
  stopStatusPolling();
  statusPollTimer = setInterval(async () => {
    const st = get();
    if (st.phase !== DominoPhase.WAITING || st.isSpectator) {
      stopStatusPolling();
      return;
    }
    try {
      const status = await apiRepository.getRoomStatus(roomId);
      if (status.status?.toLowerCase() === 'started') {
        st.socket?.requestSync(roomId);
        stopStatusPolling();
      }
    } catch {
      /* ignore */
    }
  }, 5000);
}

interface DominoStoreState {
  phase: DominoPhase;
  myHand: DominoTile[];
  opponents: { username: string; tileCount: number }[];
  board: DominoTile[];
  leftEnd: number;
  rightEnd: number;
  boneyardCount: number;
  currentPlayer: string;
  myUsername: string;
  selectedTile: DominoTile | null;
  selectedSide: 'left' | 'right' | null;
  validMoves: { tile: DominoTile; sides: ('left' | 'right')[] }[];
  sidePickTile: DominoTile | null;
  gameOver: GameOverPayload | null;
  error: string | null;
  socket: DominoSocketManager | null;
  isSpectator: boolean;
  p1Name: string;
  p2Name: string;
  turnHolder: string;
  spectatorCurrentPlayer: string;
  spectatorPlayerOneName: string;
  spectatorPlayerTwoName: string;
  spectatorPlayerThreeName: string;
  spectatorPlayerFourName: string;
  turnTimeLeft: number;
  turnTimerTotal: number;
  isPlayerTurn: boolean;
  statusMessage: string;
  waitingLobbySubtitle: string;
  spectatorsCount: number;
  opponentConfirmed: boolean;
  opponentName: string;
  matchCancelledMessage: string | null;
  opponentLeftMessage: string | null;
  apiErrorRawMessage: string | null;
  navigateBack: boolean;
  eliminationNotice: string | null;
  lastPlayedTile: DominoTile | null;
  chatGreetingOverlay: ChatGreetingOverlay | null;
  chatErrorToast: string | null;
  greetings: GreetingResponse[];
  isMovePending: boolean;
  myUserId: string;
  roomId: string;
  betAmount: number;
  initialOpponentName: string;
  hasOpponent: boolean;
  gameOverIsDraw: boolean;
  gameOverWinnerDisplayName: string | null;
}

type DominoStore = DominoStoreState & DominoStoreActions;

interface DominoStoreActions {
  initGame: (
    roomId: string,
    myUsername: string,
    opts: { isSpectator?: boolean; hasOpponent?: boolean; initialOpponentName?: string; betAmount?: number },
  ) => void;
  cleanup: () => void;
  selectTile: (tile: DominoTile | null) => void;
  playSide: (roomId: string, tile: DominoTile, side: 'left' | 'right') => void;
  draw: (roomId: string) => void;
  pass: (roomId: string) => void;
  clearError: () => void;
  handleChatEnvelope: (json: any) => void;
  clearChatErrorToast: () => void;
  loadGreetings: () => void;
  sendGreeting: (roomId: string, greetingId: string) => void;
  clearOpponentLeft: () => void;
  clearMatchCancelledToast: () => void;
  clearGenericError: () => void;
  clearEliminationNotice: () => void;
  handleDominoPayload: (raw: any) => void;
}

function mergeSpectatorNames(data: any, set: (p: Partial<DominoStoreState>) => void) {
  const names = SpectatorPayload.dominoSpectatorPlayerNames(data);
  set({
    spectatorPlayerOneName: names[0] || '',
    spectatorPlayerTwoName: names[1] || '',
    spectatorPlayerThreeName: names[2] || '',
    spectatorPlayerFourName: names[3] || '',
  });
}

export const useDominoStore = create<DominoStore>((set, get) => ({
  phase: DominoPhase.WAITING,
  myHand: [],
  opponents: [],
  board: [],
  leftEnd: -1,
  rightEnd: -1,
  boneyardCount: 0,
  currentPlayer: '',
  myUsername: '',
  selectedTile: null,
  selectedSide: null,
  validMoves: [],
  sidePickTile: null,
  gameOver: null,
  error: null,
  socket: null,
  isSpectator: false,
  p1Name: '',
  p2Name: '',
  turnHolder: '',
  spectatorCurrentPlayer: '',
  spectatorPlayerOneName: '',
  spectatorPlayerTwoName: '',
  spectatorPlayerThreeName: '',
  spectatorPlayerFourName: '',
  turnTimeLeft: 0,
  turnTimerTotal: 60,
  isPlayerTurn: false,
  statusMessage: 'domino_status_waiting_opponent',
  waitingLobbySubtitle: '',
  spectatorsCount: 0,
  opponentConfirmed: false,
  opponentName: '',
  matchCancelledMessage: null,
  opponentLeftMessage: null,
  apiErrorRawMessage: null,
  navigateBack: false,
  eliminationNotice: null,
  lastPlayedTile: null,
  chatGreetingOverlay: null,
  chatErrorToast: null,
  greetings: [],
  isMovePending: false,
  myUserId: '',
  roomId: '',
  betAmount: 0,
  initialOpponentName: '',
  hasOpponent: false,
  gameOverIsDraw: false,
  gameOverWinnerDisplayName: null,

  initGame(roomId, myUsername, opts = {}) {
    if (!roomId) return;
    dominoActiveRoomId = roomId;
    resetStateVersionTracker(dominoStateVersionTracker);
    const isSpectator = !!opts.isSpectator;
    const hasOpponent = !!opts.hasOpponent;
    const initialOpponentName = opts.initialOpponentName ?? '';
    const betAmount = opts.betAmount ?? 0;
    const acc = apiRepository.getCachedUserAccount();
    const myUserId = acc?.id ?? '';

    const statusMessage = isSpectator
      ? 'spectator_watching_status'
      : hasOpponent
        ? 'domino_status_place_pieces'
        : 'domino_status_waiting_opponent';

    stopStatusPolling();
    get().socket?.disconnect();

    const socket = new DominoSocketManager();
    socket.setOnConnected(() => {
      if (hasOpponent && !get().isSpectator) {
        apiRepository.roomReady(roomId).catch(() => {});
      }
    });

    socket.connect(roomId);
    socket.setOnGamePayload((raw) => get().handleDominoPayload(raw));

    set({
      socket,
      roomId,
      myUsername,
      myUserId,
      betAmount,
      initialOpponentName,
      hasOpponent,
      isSpectator,
      phase: DominoPhase.WAITING,
      opponentConfirmed: hasOpponent || isSpectator,
      opponentName: initialOpponentName,
      statusMessage,
      waitingLobbySubtitle: '',
      gameOver: null,
      navigateBack: false,
      matchCancelledMessage: null,
      opponentLeftMessage: null,
      apiErrorRawMessage: null,
      eliminationNotice: null,
      lastPlayedTile: null,
      sidePickTile: null,
      validMoves: [],
      myHand: [],
      board: [],
    });

    if (!isSpectator) {
      startStatusPolling(roomId, get);
      get().loadGreetings();
    } else {
      setTimeout(() => {
        if (get().phase === DominoPhase.WAITING) get().socket?.requestSync(roomId);
      }, 1500);
    }
  },

  cleanup() {
    stopStatusPolling();
    stopDominoTurnTimer();
    get().socket?.disconnect();
    set({
      socket: null,
      myHand: [],
      board: [],
      gameOver: null,
      isSpectator: false,
      phase: DominoPhase.WAITING,
      turnHolder: '',
      p1Name: '',
      p2Name: '',
      validMoves: [],
      sidePickTile: null,
    });
  },

  handleDominoPayload(payload) {
    const json = typeof payload === 'string' ? (JSON.parse(payload) as any) : payload;
    const data =
      json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data : json;
    applyIncomingStateVersion(dominoStateVersionTracker, data);
    const success = json?.success !== false;

    const st = get();
    const myUserId = st.myUserId;
    const initialOpponentName = st.initialOpponentName;
    const isSpectatorJoin = st.isSpectator;

    // Spectator count
    let sc = -1;
    if (data?.spectatorsCount !== undefined) sc = Number(data.spectatorsCount);
    else if (data?.spectators_count !== undefined) sc = Number(data.spectators_count);
    if (sc >= 0) set({ spectatorsCount: sc });

    if (isSpectatorJoin) mergeSpectatorNames(data, set);

    if (!success && json?.data == null) {
      const raw = apiMessagesJoinedOrNull(json) || '';
      if (!isInformationalNonBlockingSocketRaw(raw)) {
        set({ apiErrorRawMessage: raw });
      }
      return;
    }

    set({ isMovePending: false });

    const waitingForOpponent = !!data?.waitingForOpponent;
    const opponentJoined = !!data?.opponentJoined;
    const opponentLeft = !!data?.opponentLeft;
    const opponentName = String(data?.opponentName || data?.userName || '').trim();
    const matchCancelled = String(data?.outcome || '') === 'match_cancelled';

    if (matchCancelled) {
      set({ matchCancelledMessage: t('bs_match_cancelled'), navigateBack: true });
      return;
    }

    if (opponentLeft && waitingForOpponent) {
      if (!canAcceptWaitingLobby(get().phase, get().gameOver)) return;
      const player = String(data?.playerLeft || data?.player_left || '').trim();
      const hasRem = data?.playersRemaining !== undefined || data?.players_remaining !== undefined;
      const hasReq = data?.playersRequired !== undefined || data?.players_required !== undefined;
      const remaining =
        data?.playersRemaining ?? data?.players_remaining ?? -1;
      const required = data?.playersRequired ?? data?.players_required ?? -1;
      if (player && hasRem && hasReq) {
        const msgKey = formatPlayerLeftCounts(
          t('domino_wait_player_left_counts'),
          player,
          Number(remaining),
          Number(required),
        );
        set({
          phase: DominoPhase.WAITING,
          statusMessage: msgKey,
          waitingLobbySubtitle: '',
        });
        return;
      }
      if (player) {
        set({
          phase: DominoPhase.WAITING,
          statusMessage: t('domino_wait_player_left_name').replace('%s', player),
          waitingLobbySubtitle: '',
        });
        return;
      }
      const ws = applyWsMessagePlaceholders(t('ws.domino.playerLeftWaiting'), data);
      set({
        phase: DominoPhase.WAITING,
        statusMessage: ws,
        waitingLobbySubtitle: '',
      });
      return;
    }

    if (opponentLeft && get().phase === DominoPhase.WAITING) {
      set({
        opponentLeftMessage: t('bs_opponent_left'),
        opponentConfirmed: false,
        waitingLobbySubtitle: '',
      });
      return;
    }

    if (opponentJoined && opponentName) {
      if (waitingForOpponent) {
        set({ opponentConfirmed: true, opponentName });
      } else {
        set({ opponentConfirmed: true, opponentName, waitingLobbySubtitle: '' });
        if (!isSpectatorJoin) {
          apiRepository.roomReady(get().roomId).catch(() => {});
        }
      }
    }

    if (waitingForOpponent) {
      if (!canAcceptWaitingLobby(get().phase, get().gameOver)) return;
      const sub = buildDominoWaitingLobbySubtitle(json, data);
      if (isSpectatorJoin) {
        set({
          phase: DominoPhase.WAITING,
          statusMessage: 'spectator_watching_status',
          waitingLobbySubtitle: sub,
        });
      } else {
        set({
          phase: DominoPhase.WAITING,
          statusMessage: dominoWaitingMainMessage(data),
          waitingLobbySubtitle: sub,
        });
        // All seats filled but server still says waiting → call roomReady and
        // poll room status; when status is "started" the poll calls requestSync.
        const joined = parseLobbyJoinedCount(data);
        const required = parseLobbyRequiredCount(data);
        if (joined != null && required != null && joined >= required) {
          apiRepository.roomReady(get().roomId).catch(() => {});
          startStatusPolling(get().roomId, get);
        }
      }
      return;
    }

    const gameEnded = !!data?.gameEnded;
    if (gameEnded) {
      stopDominoTurnTimer();
      const winnerId = String(data?.winner || '').trim();
      const reasonNorm = String(data?.reason || data?.winnerReason || data?.winner_reason || '')
        .trim()
        .toLowerCase();
      const outcome = String(data?.outcome || '').trim();
      const outcomeNorm = outcome.toLowerCase();
      const isForfeitEnd = reasonNorm === 'forfeit' || outcomeNorm === 'forfeit';
      const opponentForfeit =
        outcome === 'opponent_disconnected' ||
        reasonNorm === 'opponent_disconnect' ||
        reasonNorm === 'opponent_disconnected';
      let youWon = false;
      if (opponentForfeit) youWon = true;
      else if (winnerId && myUserId) youWon = winnerId === myUserId;
      else youWon = !!data?.youWon || !!data?.you_won;

      const isDraw =
        outcomeNorm === 'draw' ||
        reasonNorm === 'draw' ||
        !!data?.isDraw ||
        !!data?.draw ||
        (!winnerId && reasonNorm !== 'timeout' && !opponentForfeit);

      const resolvedOutcome = opponentForfeit
        ? 'opponent_disconnected'
        : outcome || (isForfeitEnd ? 'forfeit' : youWon ? 'win' : 'lose');

      const spectating = isSpectatorJoin;
      const seats = SpectatorPayload.seatsForSpectatorSummary(data);

      if (spectating) {
        const reasonKey = SpectatorPayload.spectatorEndReasonFallback(data, resolvedOutcome);
        const winnerDisplay =
          !isDraw && winnerId
            ? SpectatorPayload.gameEndWinnerDisplayName(winnerId, seats)
            : null;
        const statusMsg = SpectatorPayload.spectatorGameEndReasonStatusMessage(json, data, resolvedOutcome);
        set({
          phase: DominoPhase.GAME_OVER,
          gameOverIsDraw: isDraw,
          gameOverWinnerDisplayName: winnerDisplay,
          statusMessage: statusMsg,
          gameOver: {
            outcome: isDraw ? 'draw' : 'lose',
            youWon: false,
            isDraw,
            winner: winnerDisplay || winnerId || undefined,
            reason: reasonKey,
          },
        });
        return;
      }

      const goPayload = buildDominoGameOverPayload(data, json, myUserId);
      const reasonOnlyKey = goPayload.reason || 'spectator_end_decisive';
      const body = gameEndMessageForDisplay(data, json, t(reasonOnlyKey));

      const boardParsed = parseBoardArray(data);
      const finalHand = parseHandArray(data);
      const hand = finalHand.length > 0 ? finalHand : get().myHand;

      set({
        phase: DominoPhase.GAME_OVER,
        gameOver: { ...goPayload, reason: reasonOnlyKey },
        gameOverIsDraw: isDraw,
        gameOverWinnerDisplayName: null,
        statusMessage: body,
        myHand: hand,
        board: boardParsed.tiles,
        leftEnd: boardParsed.leftEnd,
        rightEnd: boardParsed.rightEnd,
        validMoves: [],
        eliminationNotice: null,
        lastPlayedTile: null,
      });
      return;
    }

    const yourTurn = data?.hasOwnProperty('yourTurn')
      ? !!data.yourTurn
      : data?.hasOwnProperty('your_turn')
        ? !!data.your_turn
        : get().isPlayerTurn;

    const timerSeconds =
      data?.turnTimerSeconds ?? data?.turn_timer_seconds ?? data?.turnTimer ?? null;
    const gameStarted = !!data?.gameStarted;

    const lastTileArr = data?.lastTile;
    let lastPlayedTileFromPacket: DominoTile | null = null;
    if (Array.isArray(lastTileArr) && lastTileArr.length >= 2) {
      lastPlayedTileFromPacket = { a: Number(lastTileArr[0]), b: Number(lastTileArr[1]) };
    }
    const lastPlayedTile =
      lastPlayedTileFromPacket ||
      (isSpectatorJoin ? dominoLastTileFromHistory(data?.history) : null);
    const lastPlayerId = String(data?.lastPlayer || '').trim();

    let hand = get().myHand;
    if (Array.isArray(data?.hand)) {
      const parsed = parseHandArray(data);
      hand = parsed.length > 0 ? parsed : hand;
    } else if (data?.newTile && Array.isArray(data.newTile) && data.newTile.length >= 2) {
      hand = [...get().myHand, { a: Number(data.newTile[0]), b: Number(data.newTile[1]) }];
    } else if (lastPlayedTile && lastPlayerId && myUserId && lastPlayerId === myUserId) {
      const lp = lastPlayedTile;
      hand = get().myHand.filter((x) => !tilesEqual(x, lp));
    } else {
      hand = get().myHand;
    }

    const boardData = parseBoardArray(data);
    const hasBoard = data?.hasOwnProperty('board') && Array.isArray(data.board);
    const boardTiles = hasBoard ? boardData.tiles : get().board;
    const leftEnd = hasBoard ? boardData.leftEnd : get().leftEnd;
    const rightEnd = hasBoard ? boardData.rightEnd : get().rightEnd;

    const handCountObj =
      data?.handCount && typeof data.handCount === 'object' ? (data.handCount as Record<string, number>) : null;

    let boneyardCount: number;
    if (data?.hasOwnProperty('boneyardCount')) {
      boneyardCount = Number(data.boneyardCount) || 0;
    } else {
      const oppSum = handCountObj
        ? sumOpponentHandCounts(handCountObj, myUserId)
        : get().opponents.reduce((s, o) => s + o.tileCount, 0);
      boneyardCount = computeBoneyardInvariant(boardTiles.length, hand.length, oppSum);
    }

    const opponents =
      handCountObj && Object.keys(handCountObj).length > 0
        ? opponentsFromHandCount(data, handCountObj, myUserId, initialOpponentName)
        : get().opponents;

    const rawTurnUsername = String(data?.currentTurnUsername || data?.current_turn_username || '').trim();
    const resolvedTurnUsername = rawTurnUsername || get().turnHolder;

    const nextTimer = timerSeconds != null ? Number(timerSeconds) : get().turnTimeLeft;
    const nextTotal = timerSeconds != null ? Number(timerSeconds) : get().turnTimerTotal;

    let effectiveYourTurn = false;
    let validMovesResolved: { tile: DominoTile; sides: ('left' | 'right')[] }[] = [];
    let canDrawResolved = false;
    let canPassResolved = false;
    let nextStatus: string;

    if (isSpectatorJoin) {
      const turnNamed = SpectatorPayload.spectatorTurnHolderUsername(data) || rawTurnUsername;
      nextStatus = turnNamed
        ? t('spectator_turn_of_x').replace('%s', turnNamed)
        : t('spectator_waiting_next_move');
    } else {
      effectiveYourTurn = yourTurn;
      validMovesResolved = effectiveYourTurn
        ? computeValidMovesClient(hand, leftEnd, rightEnd)
        : [];
      canDrawResolved = effectiveYourTurn && validMovesResolved.length === 0 && boneyardCount > 0;
      canPassResolved = effectiveYourTurn && validMovesResolved.length === 0 && boneyardCount === 0;
      if (effectiveYourTurn && validMovesResolved.length === 0 && canDrawResolved) {
        nextStatus = 'domino_draw_needed';
      } else if (effectiveYourTurn && validMovesResolved.length === 0 && canPassResolved) {
        nextStatus = 'domino_pass_needed';
      } else if (effectiveYourTurn) {
        nextStatus = 'domino_your_turn';
      } else if (resolvedTurnUsername) {
        nextStatus = `bs_named_opponent_turn|${resolvedTurnUsername}`;
      } else {
        nextStatus = 'domino_opponent_turn';
      }
    }

    const eliminationNotice = buildEliminationNotice(data);
    const extNames = SpectatorPayload.extractStandardTurnAndNames(data);

    const metaOnlyPlayUpdate =
      !data?.hasOwnProperty('yourTurn') &&
      !data?.hasOwnProperty('your_turn') &&
      lastPlayedTileFromPacket == null &&
      !data?.hand &&
      !data?.newTile &&
      !data?.board &&
      !data?.history;

    const preservePick = isSpectatorJoin || !metaOnlyPlayUpdate;

    const beforePlay = get();
    set({
      phase: DominoPhase.PLAY,
      apiErrorRawMessage: null,
      waitingLobbySubtitle: '',
      opponentConfirmed: get().opponentConfirmed || gameStarted || opponentJoined,
      myHand: hand,
      board: boardTiles,
      leftEnd,
      rightEnd,
      boneyardCount,
      opponents,
      validMoves: validMovesResolved,
      currentPlayer: resolvedTurnUsername || get().currentPlayer,
      turnHolder: resolvedTurnUsername,
      isPlayerTurn: isSpectatorJoin ? false : effectiveYourTurn,
      turnTimeLeft: nextTimer,
      turnTimerTotal: nextTotal,
      statusMessage: nextStatus,
      lastPlayedTile: lastPlayedTile ?? get().lastPlayedTile,
      eliminationNotice,
      sidePickTile: preservePick ? get().sidePickTile : null,
      p1Name: extNames.p1 || get().p1Name,
      p2Name: extNames.p2 || get().p2Name,
      spectatorCurrentPlayer: isSpectatorJoin
        ? SpectatorPayload.spectatorTurnHolderUsername(data) || extNames.turnHolder || get().spectatorCurrentPlayer
        : get().spectatorCurrentPlayer,
    });

    if (isSpectatorJoin) {
      stopDominoTurnTimer();
    } else {
      const afterPlay = get();
      if (afterPlay.phase === DominoPhase.PLAY && afterPlay.turnTimeLeft > 0) {
        const turnChanged =
          beforePlay.isPlayerTurn !== afterPlay.isPlayerTurn ||
          (beforePlay.turnHolder || '') !== (afterPlay.turnHolder || '');
        const timerJump = Math.abs(beforePlay.turnTimeLeft - afterPlay.turnTimeLeft) > 2;
        if (turnChanged || timerJump || dominoTurnTimer == null) {
          syncDominoTurnCountdownAfterSocket(set, get);
        }
      } else {
        stopDominoTurnTimer();
      }
    }
  },

  selectTile(tile) {
    if (!tile) {
      set({ selectedTile: null, sidePickTile: null });
      return;
    }
    const { validMoves, currentPlayer, myUsername, isSpectator } = get();
    if (isSpectator || currentPlayer !== myUsername) return;
    const vm = validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
    if (!vm || vm.sides.length === 0) return;
    if (vm.sides.length === 1) {
      set({ selectedTile: tile, selectedSide: vm.sides[0], sidePickTile: null });
    } else {
      set({ sidePickTile: tile, selectedTile: null });
    }
  },

  playSide(roomId, tile, side) {
    if (get().isMovePending) return;
    set({ isMovePending: true, selectedTile: null, selectedSide: null, sidePickTile: null });
    get().socket?.playTile(roomId, [tile.a, tile.b], side);
  },

  draw(roomId) {
    if (get().isMovePending) return;
    set({ isMovePending: true });
    get().socket?.draw(roomId);
  },

  pass(roomId) {
    if (get().isMovePending) return;
    set({ isMovePending: true });
    get().socket?.pass(roomId);
  },

  clearError() {
    set({ error: null });
  },

  handleChatEnvelope(json) {
    const ev = parseChatEnvelope(json);
    if (ev.type === 'Incoming') {
      scheduleChatOverlay(set, { type: 'FromOpponent', from: ev.from, text: ev.text });
      return;
    }
    if (ev.type === 'Sent') {
      scheduleChatOverlay(set, { type: 'YouSent', text: ev.text });
      return;
    }
    if (ev.type === 'Failure') {
      const raw = ev.message;
      const msg = hasKey(raw) ? t(raw) : raw;
      set({ chatErrorToast: msg });
      if (ev.refreshGreetings) get().loadGreetings();
    }
  },

  clearChatErrorToast: () => set({ chatErrorToast: null }),

  loadGreetings: () => {
    if (get().isSpectator) return;
    apiRepository.getGreetings().then((list) => set({ greetings: list })).catch(() => {});
  },

  sendGreeting: (roomId, greetingId) => {
    const st = get();
    if (st.isSpectator || !greetingId?.trim()) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastGreetingSentAtMs < 5000) return;
    lastGreetingSentAtMs = now;
    (window as any).dominoChatSocket?.sendGreeting(roomId, greetingId);
  },

  clearOpponentLeft: () => set({ opponentLeftMessage: null }),
  clearMatchCancelledToast: () => set({ matchCancelledMessage: null }),
  clearGenericError: () => set({ apiErrorRawMessage: null }),
  clearEliminationNotice: () => set({ eliminationNotice: null }),
}));

function buildEliminationNotice(data: any): string | null {
  const player = String(data?.playerEliminated || data?.player_eliminated || '').trim();
  if (!player) return null;
  const reason = String(data?.eliminationReason || data?.elimination_reason || '')
    .trim()
    .toLowerCase();
  if (reason === 'timeout') return t('domino_player_eliminated_timeout').replace('%s', player);
  if (!reason) return t('domino_player_eliminated_generic').replace('%s', player);
  return t('domino_player_eliminated_reason').replace('%1$s', player).replace('%2$s', reason);
}
