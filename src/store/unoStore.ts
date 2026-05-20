import { create } from 'zustand';
import { UnoSocketManager } from '../data/network/UnoSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { GameOverPayload, UnoCardCode, UnoColor, UnoGamePayload, GreetingResponse } from '../data/models/ApiModels';
import { parseChatEnvelope, type ChatGreetingOverlay } from '../util/ChatGreetingModels';
import { hasKey, t } from '../i18n/translations';

export enum UnoPhase {
  WAITING = 'WAITING',
  PLAY = 'PLAY',
  /** Hand finished but match continues — client shows the scoreboard with countdown. */
  BETWEEN_ROUNDS = 'BETWEEN_ROUNDS',
  GAME_OVER = 'GAME_OVER',
}

let unoTurnTimer: ReturnType<typeof setInterval> | null = null;
let statusPollTimer: ReturnType<typeof setInterval> | null = null;

function stopUnoTurnTimer() {
  if (unoTurnTimer) {
    clearInterval(unoTurnTimer);
    unoTurnTimer = null;
  }
}

function stopStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

let chatOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
let lastGreetingSentAtMs = 0;

function scheduleUnoChatOverlay(set: (partial: Partial<UnoStoreState>) => void, overlay: ChatGreetingOverlay) {
  if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
  set({ chatGreetingOverlay: overlay });
  chatOverlayTimeout = setTimeout(() => {
    set({ chatGreetingOverlay: null });
    chatOverlayTimeout = null;
  }, 3000);
}

function startStatusPolling(roomId: string, get: () => UnoStore) {
  stopStatusPolling();
  statusPollTimer = setInterval(async () => {
    const st = get();
    if (st.phase !== UnoPhase.WAITING || st.isSpectator) {
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

interface UnoStoreState {
  phase: UnoPhase;
  socket: UnoSocketManager | null;
  roomId: string;
  myUsername: string;
  myUserId: string;
  betAmount: number;
  initialOpponentName: string;
  hasOpponent: boolean;
  isSpectator: boolean;
  isPlayer1: boolean;
  opponentConfirmed: boolean;

  // Game state
  hand: UnoCardCode[];
  topDiscard: UnoCardCode | null;
  /** Discard pile length — increments when a card is played (SFX). */
  discardCount: number;
  drawPileCount: number;
  currentColor: UnoColor;
  direction: 1 | -1;
  drawStackPending: number;
  currentTurnPlayerId: string;
  currentTurnUsername: string;
  isPlayerTurn: boolean;
  playerOrder: string[];
  usernames: Record<string, string>;
  handCount: Record<string, number>;
  eliminatedPlayers: string[];
  unoCalled: string[];
  pendingUnoOffender: string | null;
  lastActionPlayerId: string | null;
  lastActionUsername: string | null;
  turnTimeLeft: number;
  turnTimerTotal: number;

  // Picker / UX
  pendingWildIndex: number | null; // when user taps W or W4, await color choice
  toast: string | null;
  apiErrorRawMessage: string | null;
  isMovePending: boolean;
  navigateBack: boolean;
  spectatorsCount: number;

  /** Quick greetings (/chat) — same pattern as chess/domino. */
  greetings: GreetingResponse[];
  chatGreetingOverlay: ChatGreetingOverlay | null;
  chatErrorToast: string | null;

  // End of round
  gameOver: GameOverPayload | null;
  statusMessage: string;

  // Multi-round (Phase 2)
  matchScores: Record<string, number>;
  roundNumber: number;
  matchTargetScore: number;
  matchWinnerId: string | null;
  nextRoundStartsAt: string | null;
  /** Local seconds-remaining countdown derived from `nextRoundStartsAt` once per second. */
  nextRoundCountdownSec: number;
  playersReadyForNext: string[];
  roundHistory: { round: number; winnerId: string; scoreDealt: number; endedAt: string | null }[];
  /** Last round result — populated when phase transitions WAITING → BETWEEN_ROUNDS. */
  lastRoundWinnerId: string | null;
  lastRoundWinnerUsername: string | null;
  lastRoundScoreDealt: number;
  /** Cached prize awarded at match end. */
  matchPrize: number;
}

interface UnoStoreActions {
  initGame: (
    roomId: string,
    myUsername: string,
    opts: {
      isSpectator?: boolean;
      hasOpponent?: boolean;
      initialOpponentName?: string;
      betAmount?: number;
      isPlayer1?: boolean;
      /** Prefer auth user id — `getCachedUserAccount()` is often null on first paint. */
      myUserId?: string;
    },
  ) => void;
  /** Patch viewer id after auth hydrates (fixes UNO / ready / seats when cache is cold). */
  syncMyUserId: (userId: string) => void;
  cleanup: () => void;
  handleUnoPayload: (raw: unknown) => void;
  /** Tap a card. If it's a Wild, parks it and opens the color picker. */
  selectCardForPlay: (cardIndex: number) => void;
  /** Resolve a parked Wild with the chosen color and emit. */
  confirmWildColor: (color: UnoColor) => void;
  cancelWildPick: () => void;
  drawCard: () => void;
  passTurn: () => void;
  takeDrawStack: () => void;
  callUno: () => void;
  challengeUnoMiss: (offenderId: string) => void;
  /** Tap "ready" on the between-rounds scoreboard. */
  startNextRound: () => void;
  clearToast: () => void;
  clearError: () => void;
  handleChatEnvelope: (json: unknown) => void;
  clearChatErrorToast: () => void;
  loadGreetings: () => void;
  sendGreeting: (roomId: string, greetingId: string) => void;
}

type UnoStore = UnoStoreState & UnoStoreActions;

const initialState: UnoStoreState = {
  phase: UnoPhase.WAITING,
  socket: null,
  roomId: '',
  myUsername: '',
  myUserId: '',
  betAmount: 0,
  initialOpponentName: '',
  hasOpponent: false,
  isSpectator: false,
  isPlayer1: false,
  opponentConfirmed: false,
  hand: [],
  topDiscard: null,
  discardCount: 0,
  drawPileCount: 0,
  currentColor: 'R',
  direction: 1,
  drawStackPending: 0,
  currentTurnPlayerId: '',
  currentTurnUsername: '',
  isPlayerTurn: false,
  playerOrder: [],
  usernames: {},
  handCount: {},
  eliminatedPlayers: [],
  unoCalled: [],
  pendingUnoOffender: null,
  lastActionPlayerId: null,
  lastActionUsername: null,
  turnTimeLeft: 0,
  turnTimerTotal: 0,
  pendingWildIndex: null,
  toast: null,
  apiErrorRawMessage: null,
  isMovePending: false,
  navigateBack: false,
  spectatorsCount: 0,
  greetings: [],
  chatGreetingOverlay: null,
  chatErrorToast: null,
  gameOver: null,
  statusMessage: 'uno_status_waiting_opponent',
  matchScores: {},
  roundNumber: 1,
  matchTargetScore: 200,
  matchWinnerId: null,
  nextRoundStartsAt: null,
  nextRoundCountdownSec: 0,
  playersReadyForNext: [],
  roundHistory: [],
  lastRoundWinnerId: null,
  lastRoundWinnerUsername: null,
  lastRoundScoreDealt: 0,
  matchPrize: 0,
};

let nextRoundCountdownInterval: ReturnType<typeof setInterval> | null = null;
function stopNextRoundCountdown() {
  if (nextRoundCountdownInterval) {
    clearInterval(nextRoundCountdownInterval);
    nextRoundCountdownInterval = null;
  }
}

/** Pull fresh state if the next-round socket broadcast is missed (mobile background, flaky WS). */
let betweenRoundResyncTimer: ReturnType<typeof setInterval> | null = null;
function stopBetweenRoundResync() {
  if (betweenRoundResyncTimer) {
    clearInterval(betweenRoundResyncTimer);
    betweenRoundResyncTimer = null;
  }
}

function viewerHasUnoDeclared(unoCalled: string[], myUserId: string): boolean {
  const me = String(myUserId ?? '').trim();
  if (!me) return false;
  return unoCalled.some((id) => String(id) === me);
}

function isWildCode(code: UnoCardCode): boolean {
  return code === 'W' || code === 'W4';
}

export const useUnoStore = create<UnoStore>((set, get) => ({
  ...initialState,

  initGame(roomId, myUsername, opts = {}) {
    if (!roomId) return;
    const isSpectator = !!opts.isSpectator;
    const hasOpponent = !!opts.hasOpponent;
    const initialOpponentName = opts.initialOpponentName ?? '';
    const betAmount = opts.betAmount ?? 0;
    const isPlayer1 = !!opts.isPlayer1;
    const myUserId = String(opts.myUserId ?? apiRepository.getCachedUserAccount()?.id ?? '').trim();

    stopStatusPolling();
    get().socket?.disconnect();

    const socket = new UnoSocketManager();
    socket.setOnConnected(() => {
      if (hasOpponent && !get().isSpectator) {
        apiRepository.roomReady(roomId).catch(() => {});
      }
    });
    socket.connect(roomId);
    socket.setOnGamePayload((raw) => get().handleUnoPayload(raw));

    set({
      ...initialState,
      socket,
      roomId,
      myUsername,
      myUserId,
      betAmount,
      initialOpponentName,
      hasOpponent,
      isSpectator,
      isPlayer1,
      opponentConfirmed: hasOpponent || isSpectator,
      statusMessage: isSpectator
        ? 'spectator_watching_status'
        : hasOpponent
          ? 'uno_status_dealing'
          : 'uno_status_waiting_opponent',
    });

    if (!isSpectator) startStatusPolling(roomId, get);
  },

  syncMyUserId(userId) {
    const id = String(userId ?? '').trim();
    if (!id) return;
    set({ myUserId: id });
  },

  cleanup() {
    if (chatOverlayTimeout) {
      clearTimeout(chatOverlayTimeout);
      chatOverlayTimeout = null;
    }
    stopStatusPolling();
    stopUnoTurnTimer();
    stopNextRoundCountdown();
    stopBetweenRoundResync();
    get().socket?.disconnect();
    set({ ...initialState });
  },

  handleUnoPayload(raw) {
    const json = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
    const success = json?.success !== false;

    set({ isMovePending: false });

    // Failure with no data → API error toast (e.g. UNO_CALL_NOT_ALLOWED, MUST_TAKE_STACK)
    if (!success && (json?.data === undefined || json?.data === null)) {
      const messages = Array.isArray(json?.messages) ? (json.messages as string[]) : [];
      const msg = messages.join(' ').trim();
      set({ apiErrorRawMessage: msg || null });
      return;
    }

    const data = (json?.data && typeof json.data === 'object' ? (json.data as Partial<UnoGamePayload>) : (json as Partial<UnoGamePayload>));
    const messages = Array.isArray(json?.messages) ? (json.messages as string[]) : [];
    const primaryMsg = messages[0] || null;

    // Opponent left while waiting / match cancelled
    const waitingForOpponent = !!data?.waitingForOpponent;

    // Timed out for this round only — match continues; stay on table as spectator until next deal.
    if (data?.eliminatedFromRound) {
      stopUnoTurnTimer();
      set({
        isSpectator: true,
        isPlayerTurn: false,
        turnTimeLeft: 0,
        toast: primaryMsg,
        eliminatedPlayers: data?.eliminatedPlayers ?? get().eliminatedPlayers,
      });
      return;
    }

    // Match end (matchEnded true OR Phase 1 fallback gameEnded without round_ended)
    if (data?.gameEnded || data?.matchEnded) {
      stopUnoTurnTimer();
      stopNextRoundCountdown();
      stopBetweenRoundResync();
      /** Prefer explicit `winner`; fall back to `matchWinnerId` from synced payloads (some emits omit `winner`). */
      const winnerFromField = String(data?.winner ?? '').trim();
      const winnerFromMatch = String(data?.matchWinnerId ?? '').trim();
      const winner = winnerFromField || winnerFromMatch;
      const myUserId = get().myUserId;
      const youWon = winner === myUserId;
      set({
        phase: UnoPhase.GAME_OVER,
        gameOver: {
          outcome: data?.outcome ?? (youWon ? 'win' : 'lose'),
          youWon,
          isDraw: !winner,
          winner: winner || undefined,
          reason: data?.reason,
        } as GameOverPayload,
        statusMessage: primaryMsg || (youWon ? 'uno_you_won_match' : 'uno_you_lost_match'),
        matchScores: data?.matchScores ?? get().matchScores,
        roundNumber: data?.roundNumber ?? get().roundNumber,
        matchTargetScore: data?.matchTargetScore ?? get().matchTargetScore,
        matchWinnerId: winner || null,
        roundHistory: data?.roundHistory ?? get().roundHistory,
        matchPrize: typeof data?.prize === 'number' ? data.prize : get().matchPrize,
      });
      return;
    }

    // Round ended but match continues → BETWEEN_ROUNDS scoreboard.
    // Ignore stale `roundEnded` when `roundStarted` is present (next-hand broadcast may merge keys).
    const showBetweenRoundsScoreboard =
      !!data?.roundEnded &&
      !data?.roundStarted &&
      !data?.gameEnded &&
      !data?.matchEnded &&
      (data?.betweenRounds ?? true);

    if (showBetweenRoundsScoreboard) {
      stopUnoTurnTimer();
      stopBetweenRoundResync();
      const winnerId = String(data?.roundWinnerId || '').trim();
      const winnerName = String(data?.roundWinnerUsername || '').trim();
      const dealt = Number(data?.roundScoreDealt || 0);
      const startsAt = data?.nextRoundStartsAt || null;
      set({
        phase: UnoPhase.BETWEEN_ROUNDS,
        isSpectator: typeof data?.isSpectator === 'boolean' ? data.isSpectator : get().isSpectator,
        eliminatedPlayers: data?.eliminatedPlayers ?? [],
        matchScores: data?.matchScores ?? get().matchScores,
        roundNumber: data?.roundNumber ?? get().roundNumber,
        matchTargetScore: data?.matchTargetScore ?? get().matchTargetScore,
        roundHistory: data?.roundHistory ?? get().roundHistory,
        playersReadyForNext: data?.playersReadyForNext ?? [],
        nextRoundStartsAt: startsAt,
        lastRoundWinnerId: winnerId || null,
        lastRoundWinnerUsername: winnerName || null,
        lastRoundScoreDealt: dealt,
        toast: primaryMsg,
      });
      // Start the local countdown ticker.
      stopNextRoundCountdown();
      const updateCountdown = () => {
        const startsAtIso = get().nextRoundStartsAt;
        if (!startsAtIso) {
          set({ nextRoundCountdownSec: 0 });
          stopNextRoundCountdown();
          return;
        }
        const diffMs = new Date(startsAtIso).getTime() - Date.now();
        const sec = Math.max(0, Math.ceil(diffMs / 1000));
        set({ nextRoundCountdownSec: sec });
        if (sec === 0) {
          stopNextRoundCountdown();
          get().socket?.requestSync(get().roomId);
        }
      };
      updateCountdown();
      nextRoundCountdownInterval = setInterval(updateCountdown, 1000);

      betweenRoundResyncTimer = setInterval(() => {
        const st = get();
        if (st.phase !== UnoPhase.BETWEEN_ROUNDS || !st.roomId) {
          stopBetweenRoundResync();
          return;
        }
        st.socket?.requestSync(st.roomId);
      }, 4000);
      return;
    }

    if (waitingForOpponent) {
      stopBetweenRoundResync();
      set({ phase: UnoPhase.WAITING, statusMessage: primaryMsg || 'uno_status_waiting_opponent' });
      return;
    }

    const sc = data?.spectatorsCount;
    if (typeof sc === 'number') set({ spectatorsCount: sc });

    // PLAY state (also entered when a new round just started — `roundStarted` flag)
    if (data?.roundStarted) stopNextRoundCountdown();
    stopBetweenRoundResync();
    set({
      phase: UnoPhase.PLAY,
      apiErrorRawMessage: null,
      isSpectator: typeof data?.isSpectator === 'boolean' ? data.isSpectator : get().isSpectator,
      hand: data?.hand ?? get().hand,
      topDiscard: data?.topDiscard ?? get().topDiscard,
      discardCount: typeof data?.discardCount === 'number' ? data.discardCount : get().discardCount,
      drawPileCount: data?.drawPileCount ?? get().drawPileCount,
      currentColor: (data?.currentColor as UnoColor) ?? get().currentColor,
      direction: (data?.direction as 1 | -1) ?? get().direction,
      drawStackPending: data?.drawStackPending ?? 0,
      currentTurnPlayerId: data?.currentTurnPlayerId ?? get().currentTurnPlayerId,
      currentTurnUsername: data?.currentTurnUsername ?? get().currentTurnUsername,
      isPlayerTurn: !!data?.yourTurn,
      playerOrder: data?.playerOrder ?? get().playerOrder,
      usernames: data?.usernames ?? get().usernames,
      handCount: data?.handCount ?? get().handCount,
      eliminatedPlayers: data?.eliminatedPlayers ?? get().eliminatedPlayers,
      unoCalled: data?.unoCalled ?? [],
      pendingUnoOffender: data?.pendingUnoOffender ?? null,
      lastActionPlayerId: data?.lastActionPlayerId ?? null,
      lastActionUsername: data?.lastActionUsername ?? null,
      turnTimeLeft: data?.turnTimerSeconds ?? get().turnTimeLeft,
      turnTimerTotal: data?.turnTimerSeconds ?? get().turnTimerTotal,
      toast: primaryMsg,
      opponentConfirmed: get().opponentConfirmed || !!data?.gameStarted,
      matchScores: data?.matchScores ?? get().matchScores,
      roundNumber: data?.roundNumber ?? get().roundNumber,
      matchTargetScore: data?.matchTargetScore ?? get().matchTargetScore,
      matchWinnerId: data?.matchWinnerId ?? null,
      roundHistory: data?.roundHistory ?? get().roundHistory,
      playersReadyForNext: data?.playersReadyForNext ?? [],
      nextRoundStartsAt: null,
      nextRoundCountdownSec: 0,
    });

    // Reset turn timer on whose-turn change.
    stopUnoTurnTimer();
    if (get().turnTimeLeft > 0 && !get().isSpectator) {
      unoTurnTimer = setInterval(() => {
        set((s) => {
          if (s.phase !== UnoPhase.PLAY) return s;
          const next = Math.max(0, s.turnTimeLeft - 1);
          if (next === 0) stopUnoTurnTimer();
          return { ...s, turnTimeLeft: next };
        });
      }, 1000);
    }
  },

  selectCardForPlay(cardIndex) {
    const st = get();
    if (st.isMovePending || st.isSpectator) return;
    const card = st.hand[cardIndex];
    if (!card) return;
    if (isWildCode(card)) {
      // Park the play, open color picker. Auto-call UNO if this would leave us at 1.
      set({ pendingWildIndex: cardIndex });
      return;
    }
    const callUno = st.hand.length === 2; // playing this card leaves us at 1
    set({ isMovePending: true });
    st.socket?.playCard(st.roomId, cardIndex, { callUno });
  },

  confirmWildColor(color) {
    const st = get();
    if (st.pendingWildIndex == null) return;
    const idx = st.pendingWildIndex;
    const callUno = st.hand.length === 2;
    set({ pendingWildIndex: null, isMovePending: true });
    st.socket?.playCard(st.roomId, idx, { chosenColor: color, callUno });
  },

  cancelWildPick() {
    set({ pendingWildIndex: null });
  },

  drawCard() {
    const st = get();
    if (st.isMovePending || st.isSpectator || !st.isPlayerTurn) return;
    set({ isMovePending: true });
    st.socket?.drawCard(st.roomId);
  },

  passTurn() {
    const st = get();
    if (st.isMovePending || st.isSpectator || !st.isPlayerTurn) return;
    set({ isMovePending: true });
    st.socket?.passTurn(st.roomId);
  },

  takeDrawStack() {
    const st = get();
    if (st.isMovePending || st.isSpectator || !st.isPlayerTurn) return;
    set({ isMovePending: true });
    st.socket?.takeDrawStack(st.roomId);
  },

  callUno() {
    const st = get();
    if (st.isSpectator || st.phase !== UnoPhase.PLAY) return;
    if (st.hand.length !== 1 || viewerHasUnoDeclared(st.unoCalled, st.myUserId)) return;
    set({ isMovePending: true });
    st.socket?.callUno(st.roomId);
  },

  challengeUnoMiss(offenderId) {
    const st = get();
    if (st.isSpectator || st.pendingUnoOffender !== offenderId) return;
    st.socket?.challengeUnoMiss(st.roomId, offenderId);
  },

  startNextRound() {
    const st = get();
    if (st.isSpectator || st.phase !== UnoPhase.BETWEEN_ROUNDS) return;
    if (st.playersReadyForNext.includes(st.myUserId)) return;
    st.socket?.startNextRound(st.roomId);
  },

  clearToast() {
    set({ toast: null });
  },
  clearError() {
    set({ apiErrorRawMessage: null });
  },

  handleChatEnvelope(json) {
    const ev = parseChatEnvelope(json);
    if (ev.type === 'Incoming') {
      scheduleUnoChatOverlay(set, { type: 'FromOpponent', from: ev.from, text: ev.text });
      return;
    }
    if (ev.type === 'Sent') {
      scheduleUnoChatOverlay(set, { type: 'YouSent', text: ev.text });
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
    (window as unknown as { unoChatSocket?: { sendGreeting: (r: string, id: string) => void } }).unoChatSocket?.sendGreeting(
      roomId,
      greetingId,
    );
  },
}));
