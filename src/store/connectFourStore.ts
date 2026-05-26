import { create } from 'zustand';
import { ConnectFourSocketManager } from '../data/network/ConnectFourSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { ConnectFourCell, ConnectFourDisc, ConnectFourMove } from '../data/models/connectFourModels';
import type { GameOverPayload, GreetingResponse } from '../data/models/ApiModels';
import {
  apiMessagesJoinedOrNull,
  gameEndMessageForDisplay,
  isInformationalNonBlockingSocketRaw,
  normalizedGameEndReason,
  playerGameEndReasonFallback,
} from '../i18n/ApiMessageDisplay';
import { hasKey, t } from '../i18n/translations';
import { parseChatEnvelope, type ChatGreetingOverlay } from '../util/ChatGreetingModels';
import { SpectatorPayload } from '../util/SpectatorPayload';
import { thresholdSeconds, triggerTimeoutWarning } from '../ui/game/turnTimeoutAlarm';
import {
  parseLobbyJoinedCount,
  parseLobbyRequiredCount,
} from '../pages/play/domino/dominoGameLogic';
import {
  connectFourPlayStatusMessage,
  connectFourTurnHolderUsername,
  deriveConnectFourOpponentName,
  payloadIndicatesConnectFourPlay,
  parseConnectFourMoveRevision,
  resolveAppliedConnectFourMoveRevision,
  resolveConnectFourBoard,
  resolveConnectFourLastMove,
  resolveConnectFourYourColor,
  resolveConnectFourYourTurn,
  shouldApplyConnectFourPlayPayload,
} from '../pages/play/connect-four/connectFourPayloadLogic';
import { canAcceptWaitingLobby } from '../util/playPhaseGuards';

export enum ConnectFourPhase {
  WAITING = 'WAITING',
  PLAY = 'PLAY',
  GAME_OVER = 'GAME_OVER',
}

const ROWS = 6;
const COLS = 7;

function emptyBoard(): ConnectFourCell[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

function parseBoard(raw: unknown): ConnectFourCell[][] {
  if (!Array.isArray(raw) || raw.length === 0) return emptyBoard();
  return raw.map((row) => {
    if (!Array.isArray(row)) return Array(COLS).fill(null);
    return row.map((c) => (c === 'R' || c === 'Y' ? c : null)) as ConnectFourCell[];
  });
}

function parseWinningCells(raw: unknown): Array<{ row: number; col: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (Array.isArray(c) && c.length >= 2) {
        return { row: Number(c[0]), col: Number(c[1]) };
      }
      if (c && typeof c === 'object') {
        return { row: Number((c as { row?: unknown }).row), col: Number((c as { col?: unknown }).col) };
      }
      return null;
    })
    .filter(
      (c): c is { row: number; col: number } =>
        c !== null && Number.isFinite(c.row) && Number.isFinite(c.col),
    );
}

function parseLastMove(raw: unknown): ConnectFourMove | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const color = m.color === 'R' || m.color === 'Y' ? m.color : null;
  if (!color) return null;
  return {
    userId: String(m.userId ?? ''),
    row: Number(m.row),
    col: Number(m.col),
    color,
    at: String(m.at ?? ''),
  };
}

let turnTimer: ReturnType<typeof setInterval> | null = null;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;
let chatOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
let lastGreetingSentAtMs = 0;
let disconnectConnectFourSocketTimeout: ReturnType<typeof setTimeout> | null = null;
let movePendingRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
let lobbyWatchdogTimers: ReturnType<typeof setTimeout>[] = [];
/** Bumped on cleanup/init so stale socket callbacks from a prior room are ignored. */
let connectFourSocketEpoch = 0;

function teardownConnectFourSocket() {
  connectFourSocketEpoch++;
  stopLobbyWatchdog();
  if (disconnectConnectFourSocketTimeout) {
    clearTimeout(disconnectConnectFourSocketTimeout);
    disconnectConnectFourSocketTimeout = null;
  }
  if (movePendingRecoveryTimer) {
    clearTimeout(movePendingRecoveryTimer);
    movePendingRecoveryTimer = null;
  }
  const prev = (window as any).connectFourSocket as ConnectFourSocketManager | undefined;
  if (prev) {
    prev.disconnect();
    (window as any).connectFourSocket = null;
  }
}

function clearMovePendingRecoveryTimer() {
  if (movePendingRecoveryTimer) {
    clearTimeout(movePendingRecoveryTimer);
    movePendingRecoveryTimer = null;
  }
}

function scheduleMovePendingRecovery(get: () => ConnectFourStore, set: (fn: any) => void) {
  clearMovePendingRecoveryTimer();
  movePendingRecoveryTimer = setTimeout(() => {
    movePendingRecoveryTimer = null;
    const st = get();
    if (!st.isMovePending || st.phase !== ConnectFourPhase.PLAY) return;
    set({ isMovePending: false });
    const socket = (window as any).connectFourSocket as ConnectFourSocketManager | undefined;
    socket?.requestSync(st.roomId);
  }, 8000);
}

function stopLobbyWatchdog() {
  for (const t of lobbyWatchdogTimers) clearTimeout(t);
  lobbyWatchdogTimers = [];
}

function scheduleLobbyWatchdog(roomId: string, get: () => ConnectFourStore) {
  stopLobbyWatchdog();
  const attempt = async () => {
    const st = get();
    if (st.phase !== ConnectFourPhase.WAITING || st.isSpectator) return;
    try {
      const status = await apiRepository.getRoomStatus(roomId);
      if (status.status?.toLowerCase() === 'started') {
        (window as any).connectFourSocket?.requestSync(roomId);
      }
    } catch {
      /* ignore */
    }
  };
  lobbyWatchdogTimers.push(setTimeout(() => void attempt(), 2000));
  lobbyWatchdogTimers.push(setTimeout(() => void attempt(), 5000));
}

function triggerLobbyFullSync(roomId: string, get: () => ConnectFourStore) {
  if (get().isSpectator) return;
  apiRepository.roomReady(roomId).catch(() => {});
  (window as any).connectFourSocket?.requestSync(roomId);
  startStatusPolling(roomId, get);
  scheduleLobbyWatchdog(roomId, get);
}

function payloadIndicatesPlay(
  data: Record<string, unknown>,
  phase: ConnectFourPhase,
  hadMoveInFlight: boolean,
): boolean {
  return payloadIndicatesConnectFourPlay(data, phase, hadMoveInFlight);
}

function payloadTargetsCurrentRoom(
  data: Record<string, unknown>,
  get: () => ConnectFourStore,
): boolean {
  const payloadRoomId = String(data.roomId ?? data.room_id ?? '').trim();
  const activeRoomId = get().roomId.trim();
  if (!payloadRoomId || !activeRoomId) return true;
  return payloadRoomId === activeRoomId;
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function startStatusPolling(roomId: string, get: () => ConnectFourStore) {
  stopStatusPolling();
  const tick = async () => {
    const st = get();
    if (st.phase !== ConnectFourPhase.WAITING || st.isSpectator) {
      stopStatusPolling();
      return;
    }
    try {
      const socket = (window as any).connectFourSocket as ConnectFourSocketManager | undefined;
      if (st.opponentConfirmed || st.hasOpponent) {
        apiRepository.roomReady(roomId).catch(() => {});
      }
      socket?.requestSync(roomId);

      const status = await apiRepository.getRoomStatus(roomId);
      if (status.status?.toLowerCase() === 'started') {
        socket?.requestSync(roomId);
        stopStatusPolling();
      }
    } catch {
      /* ignore */
    }
  };
  void tick();
  statusPollTimer = setInterval(tick, 5000);
}

let timeoutWarned = false;

function stopTurnTimer() {
  if (turnTimer) {
    clearInterval(turnTimer);
    turnTimer = null;
  }
}

function syncTurnCountdown(set: (fn: any) => void, get: () => ConnectFourStore) {
  stopTurnTimer();
  const st = get();
  if (st.phase !== ConnectFourPhase.PLAY || st.turnTimeLeft <= 0 || st.isSpectator) return;

  const cap = st.turnTimerTotal > 0 ? st.turnTimerTotal : st.turnTimeLeft;
  timeoutWarned = false;

  queueMicrotask(() => {
    const s = get();
    if (!s.isPlayerTurn || s.isSpectator) return;
    const th = thresholdSeconds(cap);
    if (cap > 0 && cap <= th && !timeoutWarned) {
      triggerTimeoutWarning();
      timeoutWarned = true;
    }
  });

  turnTimer = setInterval(() => {
    set((s: ConnectFourStoreState) => {
      if (s.phase !== ConnectFourPhase.PLAY) return s;
      const prev = s.turnTimeLeft;
      if (prev <= 0) {
        stopTurnTimer();
        return s;
      }
      const next = Math.max(0, prev - 1);
      const capUse = s.turnTimerTotal > 0 ? s.turnTimerTotal : prev;
      if (s.isPlayerTurn && !s.isSpectator && !timeoutWarned) {
        const th = thresholdSeconds(capUse);
        if (capUse > th && prev > th && next <= th) {
          triggerTimeoutWarning();
          timeoutWarned = true;
        }
      }
      if (next === 0) stopTurnTimer();
      return { turnTimeLeft: next };
    });
  }, 1000);
}

function connectFourTurnUsername(data: Record<string, unknown>): string {
  return connectFourTurnHolderUsername(data);
}

function mergeSpectatorConnectFourLabels(
  data: Record<string, unknown>,
  set: (fn: any) => void,
) {
  const p1 = String(data.player1 ?? SpectatorPayload.optPlayerSlot(data, 1) ?? '').trim();
  const p2 = String(data.player2 ?? SpectatorPayload.optPlayerSlot(data, 2) ?? '').trim();
  const fallback1 = t('spectator_player_n').replace('%d', '1');
  const fallback2 = t('spectator_player_n').replace('%d', '2');
  set({
    spectatorRedLabel: p1 || fallback1,
    spectatorYellowLabel: p2 || fallback2,
    player1Name: p1 || fallback1,
    player2Name: p2 || fallback2,
  });
}

function connectFourSpectatorPlayStatus(data: Record<string, unknown>): string {
  const turnName = connectFourTurnUsername(data);
  return turnName
    ? t('spectator_turn_of_x').replace('%s', turnName)
    : t('spectator_waiting_next_move');
}

function scheduleChatOverlay(set: (fn: any) => void, overlay: ChatGreetingOverlay) {
  if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
  set({ chatGreetingOverlay: overlay });
  chatOverlayTimeout = setTimeout(() => {
    set({ chatGreetingOverlay: null });
    chatOverlayTimeout = null;
  }, 3000);
}

interface ConnectFourStoreState {
  phase: ConnectFourPhase;
  board: ConnectFourCell[][];
  yourColor: ConnectFourDisc | null;
  isPlayerTurn: boolean;
  winningCells: Array<{ row: number; col: number }>;
  lastMove: ConnectFourMove | null;
  turnTimeLeft: number;
  turnTimerTotal: number;
  statusMessage: string;
  turnHolder: string;
  opponentName: string;
  opponentConfirmed: boolean;
  player1Name: string;
  player2Name: string;
  isSpectator: boolean;
  spectatorsCount: number;
  myUserId: string;
  myUsername: string;
  roomId: string;
  betAmount: number;
  hasOpponent: boolean;
  gameOver: GameOverPayload | null;
  gameOverIsDraw: boolean;
  gameOverWinnerDisplayName: string | null;
  spectatorCurrentPlayer: string;
  spectatorRedLabel: string;
  spectatorYellowLabel: string;
  navigateBack: boolean;
  matchCancelledMessage: string | null;
  opponentLeftMessage: string | null;
  apiErrorRawMessage: string | null;
  illegalMoveToast: string | null;
  isMovePending: boolean;
  moveRevision: number;
  chatGreetingOverlay: ChatGreetingOverlay | null;
  chatErrorToast: string | null;
  greetings: GreetingResponse[];
}

type ConnectFourStore = ConnectFourStoreState & {
  initGame: (
    roomId: string,
    myUsername: string,
    myUserId: string,
    betAmount: number,
    hasOpponent: boolean,
    initialOpponentName: string,
    isSpectator: boolean,
  ) => void;
  cleanup: () => void;
  dropInColumn: (roomId: string, col: number) => void;
  clearIllegalMoveToast: () => void;
  clearGenericError: () => void;
  clearOpponentLeft: () => void;
  clearMatchCancelledToast: () => void;
  leaveRoom: (roomId: string) => Promise<void>;
  loadGreetings: () => void;
  sendGreeting: (roomId: string, greetingId: string) => void;
  handleChatEnvelope: (json: unknown) => void;
  clearChatErrorToast: () => void;
};

function applyPlayPayload(
  data: Record<string, unknown>,
  set: (fn: any) => void,
  get: () => ConnectFourStore,
) {
  stopStatusPolling();
  const prior = get();
  const ext = SpectatorPayload.extractStandardTurnAndNames(data);
  const p1Name = ext.p1 || String(data.player1 ?? data.player1Name ?? prior.player1Name).trim();
  const p2Name = ext.p2 || String(data.player2 ?? data.player2Name ?? prior.player2Name).trim();
  const board = resolveConnectFourBoard(data, prior.board, parseBoard);
  const winningCells = parseWinningCells(data.winningCells ?? data.winning_cells);
  const lastMove = resolveConnectFourLastMove(data, prior.lastMove, parseLastMove);
  const yourTurn = resolveConnectFourYourTurn(data, prior.isPlayerTurn);
  const spect = prior.isSpectator;
  if (spect) mergeSpectatorConnectFourLabels(data, set);

  const yourColor = resolveConnectFourYourColor(data, prior.yourColor);
  const turnHolder = connectFourTurnHolderUsername(data);

  const timerRaw = data.turnTimerSeconds ?? data.turn_timer_seconds;
  const timerSeconds = timerRaw != null ? Number(timerRaw) : prior.turnTimeLeft;
  const turnTimeLeft =
    Number.isFinite(timerSeconds) && timerSeconds > 0 ? timerSeconds : prior.turnTimeLeft;
  const turnTimerTotal =
    prior.turnTimerTotal > 0 ? prior.turnTimerTotal : turnTimeLeft > 0 ? turnTimeLeft : 30;

  const opponentName = deriveConnectFourOpponentName(
    p1Name,
    p2Name,
    prior.myUserId,
    data.players,
    prior.opponentName,
  );

  const moveRevision = resolveAppliedConnectFourMoveRevision(data, prior.moveRevision);

  const beforePlay = prior;
  set({
    phase: ConnectFourPhase.PLAY,
    board,
    yourColor,
    isPlayerTurn: yourTurn,
    winningCells,
    lastMove,
    opponentConfirmed: true,
    opponentName,
    turnHolder,
    player1Name: p1Name || prior.player1Name,
    player2Name: p2Name || prior.player2Name,
    turnTimeLeft,
    turnTimerTotal,
    isMovePending: false,
    moveRevision,
    spectatorCurrentPlayer: spect ? turnHolder || prior.spectatorCurrentPlayer : prior.spectatorCurrentPlayer,
    statusMessage: connectFourPlayStatusMessage(
      yourTurn,
      turnHolder,
      spect,
      connectFourSpectatorPlayStatus(data),
    ),
  });

  const afterPlay = get();
  if (!spect && afterPlay.phase === ConnectFourPhase.PLAY && afterPlay.turnTimeLeft > 0) {
    const turnChanged =
      beforePlay.isPlayerTurn !== afterPlay.isPlayerTurn ||
      beforePlay.turnHolder !== afterPlay.turnHolder;
    const timerJump = Math.abs(beforePlay.turnTimeLeft - afterPlay.turnTimeLeft) > 2;
    if (turnChanged || timerJump || turnTimer == null) {
      syncTurnCountdown(set, get);
    }
  } else if (spect) {
    stopTurnTimer();
  }

  stopLobbyWatchdog();
}

function handleConnectFourPayload(
  payload: unknown,
  set: (fn: any) => void,
  get: () => ConnectFourStore,
  epoch: number,
) {
  if (epoch !== connectFourSocketEpoch) return;

  const json = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const envelope = json as { success?: boolean; messages?: string[]; data?: Record<string, unknown> };
  const data =
    envelope?.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
      ? envelope.data
      : (json as Record<string, unknown>);

  if (!payloadTargetsCurrentRoom(data, get)) return;

  const success = envelope?.success !== false;
  const hadMoveInFlight = get().isMovePending;
  const myUserId = get().myUserId;

  if (get().isSpectator) {
    mergeSpectatorConnectFourLabels(data, set);
  }

  if (data?.spectatorsCount !== undefined) {
    set({ spectatorsCount: Number(data.spectatorsCount) });
  }

  if (!success && (!data || Object.keys(data).length === 0)) {
    const raw = apiMessagesJoinedOrNull(envelope) || '';
    if (!isInformationalNonBlockingSocketRaw(raw)) {
      set({ apiErrorRawMessage: raw, illegalMoveToast: raw, isMovePending: false });
    } else {
      set({ isMovePending: false });
    }
    return;
  }

  const msgRaw = apiMessagesJoinedOrNull(envelope);
  const outcomeEarly = String(data?.outcome || '').trim().toLowerCase();
  const terminalEarly = new Set([
    'win', 'lose', 'timeout_loss', 'opponent_disconnected', 'draw', 'forfeit',
  ]);
  const isTerminalPayload =
    !!data?.gameEnded ||
    !!data?.game_ended ||
    terminalEarly.has(outcomeEarly);

  if (!success && hadMoveInFlight && !isTerminalPayload) {
    set({
      isMovePending: false,
      illegalMoveToast: msgRaw || undefined,
    });
    clearMovePendingRecoveryTimer();
    (window as any).connectFourSocket?.requestSync(get().roomId);
  } else if (hadMoveInFlight) {
    set({ isMovePending: false });
    clearMovePendingRecoveryTimer();
  } else if (msgRaw && !success && !isTerminalPayload) {
    set({ illegalMoveToast: msgRaw });
  }

  const matchCancelled = String(data?.outcome || '') === 'match_cancelled';
  if (matchCancelled) {
    set({ matchCancelledMessage: t('bs_match_cancelled'), navigateBack: true, isMovePending: false });
    return;
  }

  const waitingForOpponent = !!data?.waitingForOpponent || !!data?.waiting_for_opponent;
  const opponentJoined = !!data?.opponentJoined || !!data?.opponent_joined;
  const opponentLeft = !!data?.opponentLeft || !!data?.opponent_left;
  const opponentName = String(
    data?.opponentName ?? data?.opponent_name ?? data?.userName ?? data?.user_name ?? '',
  ).trim();

  const gameEnded =
    !!data?.gameEnded ||
    !!data?.game_ended ||
    String(data?.status || '').toLowerCase() === 'finished' ||
    (!!(data?.winnerUserId ?? data?.winner_user_id) &&
      !!String(data?.reason ?? data?.winnerReason ?? data?.winner_reason ?? '').trim());
  const outcomeRaw = String(data?.outcome || '').trim();
  const terminalOutcomes = new Set([
    'win', 'lose', 'timeout_loss', 'opponent_disconnected', 'draw', 'forfeit',
  ]);

  if (gameEnded || terminalOutcomes.has(outcomeRaw.toLowerCase())) {
    stopTurnTimer();
    stopStatusPolling();
    stopLobbyWatchdog();
    const spectating = get().isSpectator;
    const reasonNorm = normalizedGameEndReason(data);
    const outcome = outcomeRaw.toLowerCase();
    const isDraw =
      outcome === 'draw' ||
      reasonNorm === 'draw' ||
      !!data?.isDraw ||
      !!data?.is_draw ||
      (!outcome && gameEnded && !String(data?.winner ?? data?.winnerUserId ?? '').trim());
    let youWon = !!data?.youWon || !!data?.you_won;
    const winnerId = String(data?.winner ?? data?.winnerUserId ?? '').trim();
    if (winnerId && myUserId) youWon = winnerId === myUserId;
    if (outcome === 'opponent_disconnected') youWon = true;

    const resolvedOutcome = outcome || (isDraw ? 'draw' : youWon ? 'win' : 'lose');
    const seats = SpectatorPayload.seatsForSpectatorSummary(data);
    const reasonFallback = playerGameEndReasonFallback(
      data,
      resolvedOutcome,
      youWon,
      isDraw,
      'CONNECT_FOUR',
      spectating,
    );
    const statusMsg = spectating
      ? SpectatorPayload.spectatorGameEndReasonStatusMessage(json, data, resolvedOutcome)
      : gameEndMessageForDisplay(data, envelope, reasonFallback);
    const winnerDisplay =
      spectating && !isDraw
        ? SpectatorPayload.gameEndWinnerDisplayName(winnerId, seats)
        : null;

    if (disconnectConnectFourSocketTimeout) clearTimeout(disconnectConnectFourSocketTimeout);
    disconnectConnectFourSocketTimeout = setTimeout(() => {
      (window as any).connectFourSocket?.disconnect();
      disconnectConnectFourSocketTimeout = null;
    }, 3000);

    const priorBoard = get().board;
    const hasTerminalBoard =
      Object.prototype.hasOwnProperty.call(data, 'board') && Array.isArray(data.board);
    set({
      phase: ConnectFourPhase.GAME_OVER,
      board: hasTerminalBoard ? parseBoard(data.board) : priorBoard,
      winningCells: parseWinningCells(data.winningCells ?? data.winning_cells) || get().winningCells,
      lastMove: resolveConnectFourLastMove(data, get().lastMove, parseLastMove),
      isPlayerTurn: false,
      isMovePending: false,
      gameOverIsDraw: isDraw,
      gameOverWinnerDisplayName: winnerDisplay,
      statusMessage: statusMsg,
      gameOver: SpectatorPayload.resolveStandardGameOver(data, get().myUsername, spectating, 'CONNECT_FOUR'),
    });
    return;
  }

  if (payloadIndicatesPlay(data, get().phase, hadMoveInFlight)) {
    const phaseStr = get().phase;
    if (
      !shouldApplyConnectFourPlayPayload(
        data,
        get().moveRevision,
        get().board,
        phaseStr,
        parseBoard,
      )
    ) {
      if (hadMoveInFlight) {
        (window as any).connectFourSocket?.requestSync(get().roomId);
      }
      return;
    }

    if (hadMoveInFlight) {
      const incomingRev = parseConnectFourMoveRevision(data);
      if (incomingRev != null && incomingRev < get().moveRevision) {
        (window as any).connectFourSocket?.requestSync(get().roomId);
        return;
      }
    }

    applyPlayPayload(data, set, get);
    return;
  }

  if (opponentLeft && waitingForOpponent) {
    if (!canAcceptWaitingLobby(get().phase, get().gameOver)) return;
    stopTurnTimer();
    stopStatusPolling();
    stopLobbyWatchdog();
    set({
      phase: ConnectFourPhase.WAITING,
      opponentConfirmed: false,
      statusMessage: 'connect_four_status_waiting',
      isPlayerTurn: false,
      isMovePending: false,
    });
    return;
  }

  if (opponentLeft && get().phase === ConnectFourPhase.WAITING) {
    set({ opponentLeftMessage: t('bs_opponent_left'), opponentConfirmed: false });
    return;
  }

  if (opponentJoined && opponentName) {
    set({ opponentConfirmed: true, opponentName });
    if (!get().isSpectator && get().phase !== ConnectFourPhase.PLAY) {
      apiRepository.roomReady(get().roomId).catch(() => {});
    }
  }

  const roomAlreadyLive =
    !!data?.gameStarted ||
    !!data?.game_started ||
    String(data?.status || '').toLowerCase() === 'started';

  if (waitingForOpponent && !roomAlreadyLive && canAcceptWaitingLobby(get().phase, get().gameOver)) {
    set({
      phase: ConnectFourPhase.WAITING,
      statusMessage: get().isSpectator
        ? 'spectator_watching_status'
        : opponentJoined
          ? 'connect_four_status_place_pieces'
          : 'connect_four_status_waiting',
      board: data?.board ? parseBoard(data.board) : get().board,
      isPlayerTurn: false,
    });
    if (!get().isSpectator) {
      const joined = parseLobbyJoinedCount(data);
      const required = parseLobbyRequiredCount(data) ?? 2;
      if (joined != null && joined >= required) {
        triggerLobbyFullSync(get().roomId, get);
      } else if (get().opponentConfirmed || get().hasOpponent || opponentJoined) {
        apiRepository.roomReady(get().roomId).catch(() => {});
        startStatusPolling(get().roomId, get);
        scheduleLobbyWatchdog(get().roomId, get);
      } else {
        startStatusPolling(get().roomId, get);
      }
    }
    return;
  }
}

export const useConnectFourStore = create<ConnectFourStore>((set, get) => ({
  phase: ConnectFourPhase.WAITING,
  board: emptyBoard(),
  yourColor: null,
  isPlayerTurn: false,
  winningCells: [],
  lastMove: null,
  turnTimeLeft: 0,
  turnTimerTotal: 30,
  statusMessage: 'connect_four_status_waiting',
  turnHolder: '',
  opponentName: '',
  opponentConfirmed: false,
  player1Name: '',
  player2Name: '',
  isSpectator: false,
  spectatorsCount: 0,
  myUserId: '',
  myUsername: '',
  roomId: '',
  betAmount: 0,
  hasOpponent: false,
  gameOver: null,
  gameOverIsDraw: false,
  gameOverWinnerDisplayName: null,
  spectatorCurrentPlayer: '',
  spectatorRedLabel: '',
  spectatorYellowLabel: '',
  navigateBack: false,
  matchCancelledMessage: null,
  opponentLeftMessage: null,
  apiErrorRawMessage: null,
  illegalMoveToast: null,
  isMovePending: false,
  moveRevision: 0,
  chatGreetingOverlay: null,
  chatErrorToast: null,
  greetings: [],

  initGame(roomId, myUsername, myUserId, betAmount, hasOpponent, initialOpponentName, isSpectator) {
    stopTurnTimer();
    stopStatusPolling();
    teardownConnectFourSocket();
    const epoch = connectFourSocketEpoch;

    set({
      roomId,
      myUsername,
      myUserId,
      betAmount,
      hasOpponent,
      opponentName: initialOpponentName,
      turnHolder: '',
      opponentConfirmed: hasOpponent || isSpectator,
      isSpectator,
      navigateBack: false,
      phase: ConnectFourPhase.WAITING,
      board: emptyBoard(),
      statusMessage: isSpectator
        ? 'spectator_watching_status'
        : hasOpponent
          ? 'connect_four_status_place_pieces'
          : 'connect_four_status_waiting',
      yourColor: null,
      gameOver: null,
      gameOverIsDraw: false,
      gameOverWinnerDisplayName: null,
      winningCells: [],
      lastMove: null,
      isPlayerTurn: false,
      isMovePending: false,
      moveRevision: 0,
      apiErrorRawMessage: null,
      illegalMoveToast: null,
      opponentLeftMessage: null,
      matchCancelledMessage: null,
    });

    const socketManager = new ConnectFourSocketManager();
    socketManager.setOnGamePayload((raw) =>
      handleConnectFourPayload(raw, set, get, epoch),
    );
    socketManager.setOnConnected(() => {
      if (epoch !== connectFourSocketEpoch) return;
      if (hasOpponent && !isSpectator) {
        apiRepository.roomReady(roomId).catch(() => {});
      }
      if (isSpectator) {
        setTimeout(() => {
          if (epoch !== connectFourSocketEpoch) return;
          if (get().roomId === roomId && get().phase === ConnectFourPhase.WAITING) {
            socketManager.requestSync(roomId);
          }
        }, 1500);
      }
    });
    socketManager.setOnDisconnected(() => {
      if (epoch !== connectFourSocketEpoch) return;
      set({ isMovePending: false });
      clearMovePendingRecoveryTimer();
    });
    socketManager.setOnConnectionError(() => set({ apiErrorRawMessage: 'bs_connection_error' }));
    socketManager.setOnProxyReconnected(() => {
      if (epoch !== connectFourSocketEpoch) return;
      const phase = get().phase;
      if (
        get().roomId === roomId &&
        (phase === ConnectFourPhase.WAITING || phase === ConnectFourPhase.PLAY)
      ) {
        socketManager.requestSync(roomId);
      }
    });
    socketManager.connect(roomId);
    (window as any).connectFourSocket = socketManager;

    if (!isSpectator) {
      startStatusPolling(roomId, get);
      get().loadGreetings();
    }
  },

  cleanup() {
    stopTurnTimer();
    stopStatusPolling();
    stopLobbyWatchdog();
    if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
    teardownConnectFourSocket();
    set({
      phase: ConnectFourPhase.WAITING,
      board: emptyBoard(),
      isPlayerTurn: false,
      isMovePending: false,
      apiErrorRawMessage: null,
      illegalMoveToast: null,
      gameOver: null,
    });
  },

  dropInColumn(roomId, col) {
    const s = get();
    if (s.isSpectator || s.phase !== ConnectFourPhase.PLAY || !s.isPlayerTurn || s.isMovePending) return;
    if (s.roomId !== roomId) return;
    const socket = (window as any).connectFourSocket as ConnectFourSocketManager | undefined;
    if (!socket?.dropDisc(roomId, col)) return;
    set({ isMovePending: true });
    scheduleMovePendingRecovery(get, set);
  },

  clearIllegalMoveToast: () => set({ illegalMoveToast: null }),
  clearGenericError: () => set({ apiErrorRawMessage: null }),
  clearOpponentLeft: () => set({ opponentLeftMessage: null }),
  clearMatchCancelledToast: () => set({ matchCancelledMessage: null }),

  async leaveRoom(roomId) {
    try {
      await apiRepository.leaveRoom(roomId);
    } catch {
      /* ignore */
    }
    (window as any).connectFourChatSocket?.disconnect();
    get().cleanup();
    set({ navigateBack: true });
  },

  loadGreetings() {
    if (get().isSpectator) return;
    apiRepository.getGreetings().then((list) => set({ greetings: list })).catch(() => {});
  },

  sendGreeting(roomId, greetingId) {
    const st = get();
    if (st.isSpectator || !greetingId?.trim()) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastGreetingSentAtMs < 5000) return;
    lastGreetingSentAtMs = now;
    (window as any).connectFourChatSocket?.sendGreeting(roomId, greetingId);
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
      set({ chatErrorToast: hasKey(raw) ? t(raw) : raw });
      if (ev.refreshGreetings) get().loadGreetings();
    }
  },

  clearChatErrorToast: () => set({ chatErrorToast: null }),
}));
