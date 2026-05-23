import { create } from 'zustand';
import { ConnectFourSocketManager } from '../data/network/ConnectFourSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { ConnectFourCell, ConnectFourDisc, ConnectFourMove } from '../data/models/connectFourModels';
import type { GameOverPayload, GreetingResponse } from '../data/models/ApiModels';
import {
  apiMessagesJoinedOrNull,
  formatApiMessageForDisplay,
  gameEndMessageForDisplay,
  isInformationalNonBlockingSocketRaw,
} from '../i18n/ApiMessageDisplay';
import { hasKey, t } from '../i18n/translations';
import { parseChatEnvelope, type ChatGreetingOverlay } from '../util/ChatGreetingModels';
import { thresholdSeconds, triggerTimeoutWarning } from '../ui/game/turnTimeoutAlarm';

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
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({ row: Number((c as any).row), col: Number((c as any).col) }))
    .filter((c) => Number.isFinite(c.row) && Number.isFinite(c.col));
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

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function startStatusPolling(roomId: string, get: () => ConnectFourStore) {
  stopStatusPolling();
  statusPollTimer = setInterval(async () => {
    const st = get();
    if (st.phase !== ConnectFourPhase.WAITING || st.isSpectator) {
      stopStatusPolling();
      return;
    }
    try {
      const status = await apiRepository.getRoomStatus(roomId);
      if (status.status?.toLowerCase() === 'started') {
        (window as any).connectFourSocket?.requestSync(roomId);
        stopStatusPolling();
      }
    } catch {
      /* ignore */
    }
  }, 5000);
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
  navigateBack: boolean;
  matchCancelledMessage: string | null;
  opponentLeftMessage: string | null;
  apiErrorRawMessage: string | null;
  illegalMoveToast: string | null;
  isMovePending: boolean;
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
  const board = parseBoard(data.board);
  const winningCells = parseWinningCells(data.winningCells ?? data.winning_cells);
  const lastMove = parseLastMove(data.lastMove ?? data.last_move);
  const yourTurn = !!data.yourTurn || !!data.your_turn;
  let yourColor: ConnectFourDisc | null =
    data.yourColor === 'R' || data.yourColor === 'Y'
      ? data.yourColor
      : data.your_color === 'R' || data.your_color === 'Y'
        ? data.your_color
        : get().yourColor;
  if (!yourColor && data.isPlayerOne !== undefined) {
    yourColor = data.isPlayerOne ? 'R' : 'Y';
  }

  const timerRaw = data.turnTimerSeconds ?? data.turn_timer_seconds;
  const timerSeconds = timerRaw != null ? Number(timerRaw) : get().turnTimeLeft;
  const turnTimeLeft = Number.isFinite(timerSeconds) && timerSeconds > 0 ? timerSeconds : get().turnTimeLeft;
  const turnTimerTotal =
    get().turnTimerTotal > 0 ? get().turnTimerTotal : turnTimeLeft > 0 ? turnTimeLeft : 30;

  set({
    phase: ConnectFourPhase.PLAY,
    board,
    yourColor,
    isPlayerTurn: yourTurn,
    winningCells,
    lastMove,
    opponentConfirmed: true,
    player1Name: String(data.player1 ?? data.player1Name ?? get().player1Name),
    player2Name: String(data.player2 ?? data.player2Name ?? get().player2Name),
    turnTimeLeft,
    turnTimerTotal,
    isMovePending: false,
    statusMessage: yourTurn ? 'connect_four_status_your_turn' : 'connect_four_status_opponent_turn',
  });

  syncTurnCountdown(set, get);
}

function handleConnectFourPayload(
  payload: unknown,
  set: (fn: any) => void,
  get: () => ConnectFourStore,
) {
  const json = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const envelope = json as { success?: boolean; messages?: string[]; data?: Record<string, unknown> };
  const data =
    envelope?.data && typeof envelope.data === 'object' && !Array.isArray(envelope.data)
      ? envelope.data
      : (json as Record<string, unknown>);

  const myUserId = get().myUserId;

  if (data?.spectatorsCount !== undefined) {
    set({ spectatorsCount: Number(data.spectatorsCount) });
  }

  if (envelope?.success === false && !data) {
    const raw = apiMessagesJoinedOrNull(envelope) || '';
    if (!isInformationalNonBlockingSocketRaw(raw)) {
      set({ apiErrorRawMessage: raw, illegalMoveToast: raw });
    }
    return;
  }

  const msgRaw = apiMessagesJoinedOrNull(envelope);
  if (msgRaw && envelope?.success === false) {
    set({ illegalMoveToast: msgRaw });
  }

  const matchCancelled = String(data?.outcome || '') === 'match_cancelled';
  if (matchCancelled) {
    set({ matchCancelledMessage: t('bs_match_cancelled'), navigateBack: true });
    return;
  }

  const waitingForOpponent = !!data?.waitingForOpponent || !!data?.waiting_for_opponent;
  const opponentJoined = !!data?.opponentJoined || !!data?.opponent_joined;
  const opponentLeft = !!data?.opponentLeft || !!data?.opponent_left;
  const opponentName = String(data?.opponentName ?? data?.opponent_name ?? '').trim();

  if (opponentLeft && waitingForOpponent) {
    stopTurnTimer();
    stopStatusPolling();
    set({
      phase: ConnectFourPhase.WAITING,
      opponentConfirmed: false,
      statusMessage: 'connect_four_status_waiting',
      isPlayerTurn: false,
    });
    return;
  }

  if (opponentLeft && get().phase === ConnectFourPhase.WAITING) {
    set({ opponentLeftMessage: t('bs_opponent_left'), opponentConfirmed: false });
    return;
  }

  if (opponentJoined && opponentName) {
    set({ opponentConfirmed: true, opponentName });
    if (!get().isSpectator) {
      apiRepository.roomReady(get().roomId).catch(() => {});
    }
  }

  if (waitingForOpponent || opponentJoined) {
    set({
      phase: ConnectFourPhase.WAITING,
      statusMessage: get().isSpectator ? 'spectator_watching_status' : 'connect_four_status_waiting',
      board: data?.board ? parseBoard(data.board) : get().board,
      isPlayerTurn: false,
    });
    if (!get().isSpectator) {
      startStatusPolling(get().roomId, get);
    }
    if (waitingForOpponent) return;
  }

  const gameEnded = !!data?.gameEnded || !!data?.game_ended;
  if (gameEnded) {
    stopTurnTimer();
    stopStatusPolling();
    const winnerId = String(data?.winner ?? data?.winnerUserId ?? '').trim();
    const reasonNorm = String(data?.reason ?? data?.winnerReason ?? '')
      .trim()
      .toLowerCase();
    const outcome = String(data?.outcome || '').trim().toLowerCase();
    const isDraw =
      outcome === 'draw' ||
      reasonNorm === 'draw' ||
      !!data?.isDraw ||
      !!data?.is_draw ||
      (!winnerId && reasonNorm !== 'timeout' && outcome !== 'forfeit');
    let youWon = !!data?.youWon || !!data?.you_won;
    if (winnerId && myUserId) youWon = winnerId === myUserId;
    if (outcome === 'opponent_disconnected') youWon = true;

    const resolvedOutcome = isDraw
      ? 'draw'
      : outcome || (youWon ? 'win' : 'lose');

    const body = gameEndMessageForDisplay(data, envelope, t('spectator_end_decisive'));

    set({
      phase: ConnectFourPhase.GAME_OVER,
      board: parseBoard(data.board),
      winningCells: parseWinningCells(data.winningCells ?? data.winning_cells),
      lastMove: parseLastMove(data.lastMove ?? data.last_move),
      isPlayerTurn: false,
      gameOverIsDraw: isDraw,
      statusMessage: body,
      gameOver: {
        outcome: resolvedOutcome,
        youWon: get().isSpectator ? false : youWon,
        isDraw,
        winner: winnerId || undefined,
        reason: reasonNorm || resolvedOutcome,
        prize: Number(data?.prize) || undefined,
      },
    });
    return;
  }

  const gameStarted = !!data?.gameStarted || !!data?.game_started;
  if (gameStarted || data?.board) {
    applyPlayPayload(data, set, get);
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
  navigateBack: false,
  matchCancelledMessage: null,
  opponentLeftMessage: null,
  apiErrorRawMessage: null,
  illegalMoveToast: null,
  isMovePending: false,
  chatGreetingOverlay: null,
  chatErrorToast: null,
  greetings: [],

  initGame(roomId, myUsername, myUserId, betAmount, hasOpponent, initialOpponentName, isSpectator) {
    stopTurnTimer();
    stopStatusPolling();

    set({
      roomId,
      myUsername,
      myUserId,
      betAmount,
      hasOpponent,
      opponentName: initialOpponentName,
      opponentConfirmed: hasOpponent || isSpectator,
      isSpectator,
      navigateBack: false,
      phase: ConnectFourPhase.WAITING,
      board: emptyBoard(),
      statusMessage: isSpectator ? 'spectator_watching_status' : 'connect_four_status_waiting',
      yourColor: null,
      gameOver: null,
      isMovePending: false,
    });

    const socketManager = new ConnectFourSocketManager();
    socketManager.setOnGamePayload((raw) => handleConnectFourPayload(raw, set, get));
    socketManager.setOnConnected(() => {
      if (hasOpponent && !isSpectator) {
        apiRepository.roomReady(roomId).catch(() => {});
      }
      if (isSpectator) {
        setTimeout(() => {
          if (get().phase === ConnectFourPhase.WAITING) {
            (window as any).connectFourSocket?.requestSync(roomId);
          }
        }, 1500);
      }
    });
    socketManager.setOnConnectionError(() => set({ apiErrorRawMessage: 'bs_connection_error' }));
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
    if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
    if ((window as any).connectFourSocket) {
      (window as any).connectFourSocket.disconnect();
      (window as any).connectFourSocket = null;
    }
    set({
      phase: ConnectFourPhase.WAITING,
      board: emptyBoard(),
      isPlayerTurn: false,
      isMovePending: false,
    });
  },

  dropInColumn(roomId, col) {
    const s = get();
    if (s.isSpectator || s.phase !== ConnectFourPhase.PLAY || !s.isPlayerTurn || s.isMovePending) return;
    set({ isMovePending: true });
    (window as any).connectFourSocket?.dropDisc(roomId, col);
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
