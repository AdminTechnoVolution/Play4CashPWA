import { create } from 'zustand';
import { ChessSocketManager } from '../data/network/ChessSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import { 
  applyWsMessagePlaceholders, 
  apiMessagesJoinedOrNull, 
  gameEndMessageForDisplay,
  normalizedGameEndReason, 
  playerGameEndReasonFallback, 
  PlayerGameEndReasonProfile 
} from '../i18n/ApiMessageDisplay';
import { GameOverPayload } from '../data/models/ApiModels';
import { SpectatorPayload } from '../util/SpectatorPayload';
import { parseChatEnvelope, ChatGreetingOverlay } from '../util/ChatGreetingModels';

export enum ChessPhase { WAITING = 'WAITING', PLAY = 'PLAY', GAME_OVER = 'GAME_OVER' }
export enum ChessPieceType { KING = 'KING', QUEEN = 'QUEEN', ROOK = 'ROOK', BISHOP = 'BISHOP', KNIGHT = 'KNIGHT', PAWN = 'PAWN' }

export interface ChessPiece {
  type: ChessPieceType;
  isWhite: boolean;
}

export interface ChessCell {
  piece: ChessPiece | null;
}

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface CastlingAvailable {
  kingSide: boolean;
  queenSide: boolean;
}

const CHESS_BOARD_SIZE = 8;

interface ChessState {
  phase: ChessPhase;
  board: ChessCell[][];
  isPlayerTurn: boolean;
  isPlayerWhite: boolean;
  selectedRow: number | null;
  selectedCol: number | null;
  validMoves: ChessMove[];
  lastMove: ChessMove | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isMovePending: boolean;
  turnTimeLeft: number;
  turnTimerTotal: number;
  promotionPending: ChessMove | null;
  statusMessage: string;
  opponentName: string;
  opponentConfirmed: boolean;
  winner: string | null;
  gameEndYouWon: boolean | null;
  prize: number | null;
  betAmount: number;
  apiErrorRawMessage: string | null;
  navigateBack: boolean;
  matchCancelledMessage: string | null;
  opponentLeftMessage: string | null;
  isLeaving: boolean;
  illegalMoveToast: string | null;
  castlingAvailable: CastlingAvailable;
  castlingBannerDismissed: boolean;
  castlingSuppressedForTurn: boolean;
  optimisticRookSlide: ChessMove | null;
  boardBeforePendingCastle: ChessCell[][] | null;
  spectatorsCount: number;
  gameOverIsDraw: boolean;
  gameOverWinnerDisplayName: string | null;
  spectatorWhiteLabel: string;
  spectatorBlackLabel: string;
  spectatorSeatOneName: string;
  spectatorSeatTwoName: string;
  isSpectator: boolean;
  gameOver: GameOverPayload | null;
  p1Name: string;
  p2Name: string;
  turnHolder: string;
  spectatorCurrentPlayer: string;
  myUsername: string;
  chatGreetingOverlay: ChatGreetingOverlay | null;
  chatErrorToast: string | null;

  // Actions
  initGame: (roomId: string, myUsername: string, betAmount: number, hasOpponent: boolean, initialOpponentName: string, isSpectator: boolean) => void;
  cleanup: () => void;
  onCellTap: (row: number, col: number, roomId: string) => void;
  playCastling: (roomId: string, kingSide: boolean) => void;
  onPromotionSelected: (roomId: string, piece: string) => void;
  dismissCastlingSuggestion: () => void;
  dismissPromotion: () => void;
  clearGenericError: () => void;
  clearOpponentLeft: () => void;
  clearIllegalMoveToast: () => void;
  leaveRoom: (roomId: string) => Promise<void>;
  sendGreeting: (roomId: string, greetingId: string) => void;
}

const createInitialBoard = (): ChessCell[][] => 
  Array(CHESS_BOARD_SIZE).fill(null).map(() => Array(CHESS_BOARD_SIZE).fill(null).map(() => ({ piece: null })));

let countdownInterval: any = null;
let statusPollingInterval: any = null;
let chatOverlayTimeout: any = null;

export const useChessStore = create<ChessState>((set, get) => ({
  phase: ChessPhase.WAITING,
  board: createInitialBoard(),
  isPlayerTurn: false,
  isPlayerWhite: true,
  selectedRow: null,
  selectedCol: null,
  validMoves: [],
  lastMove: null,
  isCheck: false,
  isCheckmate: false,
  isDraw: false,
  isMovePending: false,
  turnTimeLeft: 0,
  turnTimerTotal: 0,
  promotionPending: null,
  statusMessage: '',
  opponentName: '',
  opponentConfirmed: false,
  winner: null,
  gameEndYouWon: null,
  prize: null,
  betAmount: 0,
  apiErrorRawMessage: null,
  navigateBack: false,
  matchCancelledMessage: null,
  opponentLeftMessage: null,
  isLeaving: false,
  illegalMoveToast: null,
  castlingAvailable: { kingSide: false, queenSide: false },
  castlingBannerDismissed: false,
  castlingSuppressedForTurn: false,
  optimisticRookSlide: null,
  boardBeforePendingCastle: null,
  spectatorsCount: 0,
  gameOverIsDraw: false,
  gameOverWinnerDisplayName: null,
  spectatorWhiteLabel: '',
  spectatorBlackLabel: '',
  spectatorSeatOneName: '',
  spectatorSeatTwoName: '',
  isSpectator: false,
  gameOver: null,
  p1Name: '',
  p2Name: '',
  turnHolder: '',
  spectatorCurrentPlayer: '',
  myUsername: '',
  chatGreetingOverlay: null,
  chatErrorToast: null,

  initGame: (roomId, myUsername, betAmount, hasOpponent, initialOpponentName, isSpectator) => {
    set({
      myUsername,
      betAmount,
      opponentConfirmed: hasOpponent || isSpectator,
      opponentName: initialOpponentName,
      isSpectator,
      statusMessage: isSpectator ? 'spectator_waiting_next_move' : (hasOpponent ? 'chess_status_place_pieces' : 'chess_status_waiting_opponent'),
      navigateBack: false,
      phase: ChessPhase.WAITING,
      board: createInitialBoard(),
    });

    const socketManager = new ChessSocketManager();
    socketManager.onChessMessage((json) => handleChessMessage(json, set, get));
    socketManager.onConnected = () => {
      if (hasOpponent && !isSpectator) apiRepository.roomReady(roomId).catch(() => {});
    };
    socketManager.connect(roomId);

    (window as any).chessSocket = socketManager;

    if (!isSpectator) {
      startStatusPolling(roomId, set, get);
    }
  },

  cleanup: () => {
    if (countdownInterval) clearInterval(countdownInterval);
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    if (chatOverlayTimeout) clearTimeout(chatOverlayTimeout);
    if ((window as any).chessSocket) {
      (window as any).chessSocket.disconnect();
      (window as any).chessSocket = null;
    }
    set({
      phase: ChessPhase.WAITING,
      board: createInitialBoard(),
      isPlayerTurn: false,
      isMovePending: false,
      selectedRow: null,
      selectedCol: null,
      validMoves: [],
    });
  },

  onCellTap: (row, col, roomId) => {
    const s = get();
    if (s.isSpectator || s.phase !== ChessPhase.PLAY || s.isMovePending || s.promotionPending || !s.isPlayerTurn) return;

    const selR = s.selectedRow;
    const selC = s.selectedCol;

    if (selR !== null && selC !== null) {
      if (row === selR && col === selC) {
        set({ selectedRow: null, selectedCol: null });
        return;
      }
      const matchingMove = s.validMoves.find(m => 
        ((m.fromRow === selR && m.fromCol === selC) || (m.fromRow === -1 && m.fromCol === -1)) &&
        m.toRow === row && m.toCol === col
      );

      if (matchingMove) {
        const fromR = matchingMove.fromRow >= 0 ? matchingMove.fromRow : selR;
        const fromC = matchingMove.fromCol >= 0 ? matchingMove.fromCol : selC;
        submitPlayerMove(fromR, fromC, matchingMove.toRow, matchingMove.toCol, set, get);
        return;
      }

      const destCell = s.board[row][col];
      const isDestMyPiece = destCell.piece && (destCell.piece.isWhite === s.isPlayerWhite);
      if (isDestMyPiece) {
        set({ selectedRow: row, selectedCol: col });
        return;
      }
      set({ selectedRow: null, selectedCol: null });
      return;
    }

    const cell = s.board[row][col];
    if (cell.piece && cell.piece.isWhite === s.isPlayerWhite) {
      set({ selectedRow: row, selectedCol: col });
    }
  },

  playCastling: (roomId, kingSide) => {
    const s = get();
    if (s.isSpectator || s.phase !== ChessPhase.PLAY || s.isMovePending) return;
    if (kingSide && !s.castlingAvailable.kingSide) return;
    if (!kingSide && !s.castlingAvailable.queenSide) return;

    const kingRow = s.isPlayerWhite ? 7 : 0;
    const kingFromCol = 4;
    const kingToCol = kingSide ? 6 : 2;
    const rookFromCol = kingSide ? 7 : 0;
    const rookToCol = kingSide ? 5 : 3;

    const newBoard = applyCastlingOnBoard(s.board, s.isPlayerWhite, kingSide);
    const kingMove = { fromRow: kingRow, fromCol: kingFromCol, toRow: kingRow, toCol: kingToCol };
    const rookSlide = { fromRow: kingRow, fromCol: rookFromCol, toRow: kingRow, toCol: rookToCol };

    (window as any).chessSocket?.move(roomId, kingRow, kingFromCol, kingRow, kingToCol, null);
    set({
      board: newBoard,
      lastMove: kingMove,
      optimisticRookSlide: rookSlide,
      boardBeforePendingCastle: JSON.parse(JSON.stringify(s.board)),
      isMovePending: true,
      selectedRow: null,
      selectedCol: null,
      validMoves: [],
      castlingSuppressedForTurn: true,
    });
  },

  onPromotionSelected: (roomId, piece) => {
    const s = get();
    const pending = s.promotionPending;
    if (!pending) return;
    const p = piece.trim().toLowerCase().charAt(0);
    sendMove(roomId, pending.fromRow, pending.fromCol, pending.toRow, pending.toCol, p, set);
  },

  dismissCastlingSuggestion: () => set({ castlingBannerDismissed: true }),
  dismissPromotion: () => set({ promotionPending: null }),
  clearGenericError: () => set({ apiErrorRawMessage: null }),
  clearOpponentLeft: () => set({ opponentLeftMessage: null }),
  clearIllegalMoveToast: () => set({ illegalMoveToast: null }),

  leaveRoom: async (roomId) => {
    set({ isLeaving: true });
    try {
      await apiRepository.leaveRoom(roomId);
    } catch (e) {}
    get().cleanup();
    set({ navigateBack: true, isLeaving: false });
  },

  sendGreeting: (roomId, greetingId) => {
    (window as any).chessSocket?.sendGreeting(roomId, greetingId);
  },
}));

// --- Pure Port of ChessViewModel.kt Internal Logic ---

function handleChessMessage(json: any, set: any, get: any) {
  const state = get();
  const hadMoveInFlight = state.isMovePending;
  const data = json.data || json;

  applySpectatorBroadcast(data, set);
  mergeSpectatorChessLabels(data, state, set);

  // ── Spectator refresh: extract player names + turn holder from every event ──
  // Mirrors Android update (Battleship/Chess parity)
  if (state.isSpectator) {
    const { p1: ep1, p2: ep2, turnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);
    const nameUpdates: any = {};
    if (ep1) nameUpdates.p1Name = ep1;
    if (ep2) nameUpdates.p2Name = ep2;
    if (turnHolder) nameUpdates.spectatorCurrentPlayer = turnHolder;
    if (Object.keys(nameUpdates).length > 0) set(nameUpdates);
  }

  const success = json.success !== false;
  if (!success && json.data === undefined) {
    const raw = apiMessagesJoinedOrNull(json) || "";
    const revert = state.boardBeforePendingCastle;
    const moveToast = hadMoveInFlight ? (
      localizedToastForChessMoveRejection(json) || 
      (apiMessagesJoinedOrNull(json) || "").trim() || 
      "ws.games.invalidMove"
    ) : null;

    set({
      apiErrorRawMessage: raw,
      isMovePending: false,
      board: revert || state.board,
      boardBeforePendingCastle: null,
      optimisticRookSlide: null,
      illegalMoveToast: moveToast,
    });
    return;
  }

  // Common move failure handling (even if data exists)
  // lines 396-414 in Kotlin
  const showIllegalMoveToast = !success && jsonMessagesContainIllegalMove(json);
  const revertBoard = showIllegalMoveToast ? state.boardBeforePendingCastle : null;
  const serverMoveFailureMsg = (apiMessagesJoinedOrNull(json) || "").trim();
  const illegalOrInvalidToast = (!success && hadMoveInFlight && !isChessTerminalOrCancelledPayload(data)) ? (
    localizedToastForChessMoveRejection(json) || serverMoveFailureMsg || "ws.games.invalidMove"
  ) : null;

  set({
    isMovePending: false,
    illegalMoveToast: illegalOrInvalidToast,
    board: revertBoard || state.board,
    boardBeforePendingCastle: revertBoard ? null : state.boardBeforePendingCastle,
    optimisticRookSlide: revertBoard ? null : state.optimisticRookSlide,
  });

  if (!success && hadMoveInFlight) {
    if (showIllegalMoveToast && revertBoard) {
      if (data.castlingAvailable) set({ castlingAvailable: parseCastlingAvailable(data) });
      return;
    }
    if (data.castlingAvailable) set({ castlingAvailable: parseCastlingAvailable(data) });
    return;
  }

  // --- Normal Path ---

  const waitingForOpponent = !!data.waitingForOpponent;
  const opponentJoined = !!data.opponentJoined;
  const opponentLeft = !!data.opponentLeft;
  const opponentName = (data.opponentName || data.userName || "").trim();
  const matchCancelled = (data.outcome || "") === "match_cancelled";
  const gameEnded = !!data.gameEnded;

  if (matchCancelled) {
    set({ matchCancelledMessage: "bs_match_cancelled", navigateBack: true });
    return;
  }
  if (opponentLeft && state.phase === ChessPhase.WAITING) {
    set({ opponentLeftMessage: "bs_opponent_left", opponentConfirmed: false });
    return;
  }

  applyPlayerOrientation(data, set);

  if (opponentJoined && opponentName.length > 0) {
    set({ opponentConfirmed: true, opponentName });
    if (!state.isSpectator) {
      const roomId = (window as any).currentRoomId;
      apiRepository.roomReady(roomId).catch(() => {});
    }
  }

  const outcome = (data.outcome || "").toString();
  const prize = data.prize > 0 ? data.prize : null;

  const terminalOutcomes = new Set([
    "win", "lose", "timeout_loss", "opponent_disconnected",
    "draw", "stalemate", "forfeit", "checkmate", "insufficient_material",
  ]);

  if (gameEnded || terminalOutcomes.has(outcome)) {
    if (countdownInterval) clearInterval(countdownInterval);
    const spectating = state.isSpectator;
    const gameOver = SpectatorPayload.resolveStandardGameOver(data, get().myUsername, spectating, 'CHESS');

    set({
      phase: ChessPhase.GAME_OVER,
      gameOver,
    });
    return;
  }

  const newBoard = parseBoard(data.board);
  if (newBoard) {
    const prev = get();
    const spect = prev.isSpectator;
    const yourTurn = !!(data.yourTurn || data.your_turn);
    const turnBecameOurs = yourTurn && !prev.isPlayerTurn && !spect;
    const castling = parseCastlingAvailable(data);
    
    const validMovesJson = data.validMoves || data.valid_moves || data.legalMoves || data.legal_moves || data.moves;
    const validMoves = parseValidMoves(validMovesJson);
    
    const remainingFromServer = parseRemainingSecondsFromServer(data);
    const [nextLeft, nextTotal] = computeTurnTimersFromPayload(data, prev, yourTurn, remainingFromServer);
    
    const lastMoveJson = data.lastMove || data.last_move;
    const lastMove = parseLastMove(lastMoveJson) || parseLastMoveFromHistory(data.history);
    
    const isCheck = !!(data.check || data.inCheck);
    const isCheckmate = !!data.checkmate;
    const isDraw = !!(data.draw || data.stalemate);
    const promotionRequired = !!data.promotionRequired;
    const pFrom = data.promotionFrom;
    const pTo = data.promotionTo;

    const promotionPending = (promotionRequired && pFrom && pTo) ? {
      fromRow: pFrom.row ?? pFrom.r ?? 0,
      fromCol: pFrom.col ?? pFrom.c ?? 0,
      toRow: pTo.row ?? pTo.r ?? 0,
      toCol: pTo.col ?? pTo.c ?? 0,
    } : null;

    const { p1, p2, turnHolder: syncTurnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);

    set({
      phase: ChessPhase.PLAY,
      gameEndYouWon: null,
      board: newBoard,
      isPlayerTurn: yourTurn && !spect,
      selectedRow: null,
      selectedCol: null,
      validMoves: spect ? [] : validMoves,
      lastMove,
      isCheck,
      isCheckmate,
      isDraw,
      p1Name: p1,
      p2Name: p2,
      turnHolder: syncTurnHolder,
      promotionPending: spect ? null : promotionPending,
      turnTimeLeft: nextLeft,
      turnTimerTotal: nextTotal,
      statusMessage: spect ? (
        chessSpectatorPlayStatus(data, isCheckmate, isCheck, isDraw, lastMove)
      ) : (
        promotionPending ? "chess_promotion_title" :
        isCheckmate ? (yourTurn ? "chess_checkmate_you" : "chess_checkmate_opponent") :
        isCheck ? (yourTurn ? "chess_check_you" : "chess_check_opponent") :
        isDraw ? "chess_draw" :
        yourTurn ? "chess_your_turn" :
        `bs_named_opponent_turn|${syncTurnHolder || prev.opponentName}`
      ),
      castlingAvailable: castling,
      castlingBannerDismissed: turnBecameOurs ? false : prev.castlingBannerDismissed,
      castlingSuppressedForTurn: turnBecameOurs ? false : prev.castlingSuppressedForTurn,
      optimisticRookSlide: null,
      boardBeforePendingCastle: null,
    });

    syncCountdownAfterTimerUpdate(prev, nextLeft, yourTurn, remainingFromServer !== null, set);
  } else if (waitingForOpponent || opponentJoined) {
    set({
      phase: ChessPhase.WAITING,
      gameEndYouWon: null,
      statusMessage: opponentJoined ? "chess_status_place_pieces" : "chess_status_waiting_opponent",
      castlingAvailable: { kingSide: false, queenSide: false },
      castlingBannerDismissed: false,
      castlingSuppressedForTurn: false,
      optimisticRookSlide: null,
      boardBeforePendingCastle: null,
    });
    const roomId = (window as any).currentRoomId;
    if (roomId) startStatusPolling(roomId, set, get);
  }
}

// Helper replicators (Line-by-line)

function applyPlayerOrientation(data: any, set: any) {
  if (data.playingWhite !== undefined) set({ isPlayerWhite: !!data.playingWhite });
  else if (data.playing_white !== undefined) set({ isPlayerWhite: !!data.playing_white });
  else if (data.isPlayerWhite !== undefined) set({ isPlayerWhite: !!data.isPlayerWhite });
  else if (data.youAreWhite !== undefined) set({ isPlayerWhite: !!data.youAreWhite });
  else if (data.yourColor !== undefined) {
    const c = data.yourColor ?? data.playerColor ?? 1;
    set({ isPlayerWhite: c === 1 });
  }
}

function resolveYouWon(data: any, outcome: string): boolean {
  const legacyDefault = (outcome === "win" || outcome === "opponent_disconnected");
  return data.youWon !== undefined ? !!data.youWon : legacyDefault;
}

function isChessTerminalOrCancelledPayload(data: any): boolean {
  if (data.gameEnded) return true;
  if (data.outcome === "match_cancelled") return true;
  return false;
}

function applySpectatorBroadcast(data: any, set: any) {
  const sc = data.spectatorsCount ?? data.spectators_count ?? -1;
  if (sc >= 0) set({ spectatorsCount: sc });
}

function mergeSpectatorChessLabels(data: any, state: any, set: any) {
  if (!state.isSpectator) return;
  const seats = SpectatorPayload.parseSeats(data);
  const co = SpectatorPayload.creatorOpponentUsernames(data);
  const [w, b] = SpectatorPayload.whiteBlackDisplayNames(data, seats);
  const useCreatorOpponent = co && !w && !b;
  const wFinal = (useCreatorOpponent ? co[0] : w) || SpectatorPayload.fallbackPlayerName(1);
  const bFinal = (useCreatorOpponent ? co[1] : b) || SpectatorPayload.fallbackPlayerName(2);
  const s1 = (co && co[0]) || (seats[0]?.displayName) || SpectatorPayload.fallbackPlayerName(1);
  const s2 = (co && co[1]) || (seats[1]?.displayName) || SpectatorPayload.fallbackPlayerName(2);
  
  set({
    spectatorWhiteLabel: wFinal,
    spectatorBlackLabel: bFinal,
    spectatorSeatOneName: s1,
    spectatorSeatTwoName: s2,
  });
}

function formatChessSquareForSpectator(row: number, col: number): string {
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = CHESS_BOARD_SIZE - row;
  return `${file}${rank}`;
}

function chessSpectatorPlayStatus(data: any, isCheckmate: boolean, isCheck: boolean, isDraw: boolean, lastMove: ChessMove | null): string {
  const turnName = SpectatorPayload.spectatorTurnHolderUsername(data);
  const mover = turnName || SpectatorPayload.fallbackPlayerName(1);
  const base = isCheckmate ? `spectator_chess_checkmate_x|${mover}` :
               isCheck ? `spectator_chess_check_x|${mover}` :
               isDraw ? "chess_draw" :
               turnName ? `spectator_turn_of_x|${turnName}` : "spectator_waiting_next_move";

  if (isCheckmate || isDraw || !lastMove) return base;
  const lm = `${formatChessSquareForSpectator(lastMove.fromRow, lastMove.fromCol)}→${formatChessSquareForSpectator(lastMove.toRow, lastMove.toCol)}`;
  return `${base} · ${lm}`;
}

function jsonMessagesContainIllegalMove(json: any): boolean {
  const msgs = json.messages || [];
  return msgs.some((m: any) => m?.toLowerCase().includes("illegal"));
}

function localizedToastForChessMoveRejection(json: any): string | null {
  const arr = json.messages || [];
  if (arr.includes('ws.chess.illegalMoveInCheck')) return 'ws.chess.illegalMoveInCheck';
  if (arr.includes('ws.chess.illegalMove')) return 'ws.chess.illegalMove';
  if (arr.includes('ws.games.illegalMove')) return 'ws.games.illegalMove';
  return null;
}

function parseRemainingSecondsFromServer(data: any): number | null {
  const v = data.turnTimerSeconds ?? data.turn_timer_seconds ?? data.turn_timer ?? data.turnTimeLeft ?? data.turn_time_left ?? data.timeLeft ?? data.secondsLeft ?? data.seconds_left;
  return (v !== undefined) ? v : null;
}

function computeTurnTimersFromPayload(data: any, prev: any, yourTurn: boolean, remaining: number | null): [number, number] {
  const cap = data.turnTimerSeconds ?? data.turn_timer_seconds ?? 60;
  let nextLeft = (remaining !== null) ? remaining : (yourTurn ? (cap || prev.turnTimeLeft) : (cap || prev.turnTimeLeft));
  return [nextLeft, cap];
}

function syncCountdownAfterTimerUpdate(prev: any, nextLeft: number, yourTurn: boolean, forceReset: boolean, set: any) {
  if (countdownInterval) clearInterval(countdownInterval);
  if (nextLeft <= 0) return;
  set({ turnTimeLeft: nextLeft });
  countdownInterval = setInterval(() => {
    set((s: any) => {
      const current = Math.max(0, s.turnTimeLeft - 1);
      if (current === 0) clearInterval(countdownInterval);
      return { turnTimeLeft: current };
    });
  }, 1000);
}

// Board parsing replicators

function parseBoard(arr: any): ChessCell[][] | null {
  if (!Array.isArray(arr) || arr.length !== CHESS_BOARD_SIZE) return null;
  return arr.map(rowArr => {
    return rowArr.map((cell: any) => {
      let piece: ChessPiece | null = null;
      if (cell && typeof cell === 'object') piece = parsePieceFromObject(cell);
      else if (typeof cell === 'string') piece = parsePieceFromString(cell);
      else if (typeof cell === 'number') piece = parsePieceFromInt(cell);
      return { piece };
    });
  });
}

function parsePieceFromObject(obj: any): ChessPiece | null {
  const typeStr = (obj.type || obj.piece || "").toString().toLowerCase();
  let type: ChessPieceType | null = null;
  if (typeStr.includes('king') || typeStr === 'k') type = ChessPieceType.KING;
  else if (typeStr.includes('queen') || typeStr === 'q') type = ChessPieceType.QUEEN;
  else if (typeStr.includes('rook') || typeStr === 'r') type = ChessPieceType.ROOK;
  else if (typeStr.includes('bishop') || typeStr === 'b') type = ChessPieceType.BISHOP;
  else if (typeStr.includes('knight') || typeStr === 'n') type = ChessPieceType.KNIGHT;
  else if (typeStr.includes('pawn') || typeStr === 'p') type = ChessPieceType.PAWN;
  if (!type) return null;

  let isWhite = true;
  if (obj.color !== undefined) {
    if (typeof obj.color === 'number') isWhite = obj.color === 1;
    else isWhite = ["white", "w", "1"].includes(obj.color.toString().toLowerCase());
  } else if (obj.isWhite !== undefined) {
    isWhite = !!obj.isWhite;
  }
  return { type, isWhite };
}

function parsePieceFromString(s: string): ChessPiece | null {
  if (!s) return null;
  const ch = s[0];
  const type = getPieceTypeFromChar(ch);
  if (!type) return null;
  return { type, isWhite: ch === ch.toUpperCase() };
}

function parsePieceFromInt(v: number): ChessPiece | null {
  if (v === 0) return null;
  const isWhite = v >= 1 && v <= 6;
  const typeIdx = isWhite ? v : v - 6;
  const types = [null, ChessPieceType.KING, ChessPieceType.QUEEN, ChessPieceType.ROOK, ChessPieceType.BISHOP, ChessPieceType.KNIGHT, ChessPieceType.PAWN];
  const type = types[typeIdx];
  return type ? { type, isWhite } : null;
}

function getPieceTypeFromChar(ch: string): ChessPieceType | null {
  switch (ch.toUpperCase()) {
    case 'K': return ChessPieceType.KING;
    case 'Q': return ChessPieceType.QUEEN;
    case 'R': return ChessPieceType.ROOK;
    case 'B': return ChessPieceType.BISHOP;
    case 'N': return ChessPieceType.KNIGHT;
    case 'P': return ChessPieceType.PAWN;
    default: return null;
  }
}

function parseValidMoves(arr: any): ChessMove[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (Array.isArray(item)) {
      if (item.length === 4) return { fromRow: item[0], fromCol: item[1], toRow: item[2], toCol: item[3] };
      if (item.length === 2) return { fromRow: -1, fromCol: -1, toRow: item[0], toCol: item[1] };
    } else if (item && typeof item === 'object') {
      const from = item.from || {};
      const to = item.to || {};
      return {
        fromRow: from.row ?? from.r ?? item.fromRow ?? item.from_row ?? -1,
        fromCol: from.col ?? from.c ?? item.fromCol ?? item.from_col ?? -1,
        toRow: to.row ?? to.r ?? item.toRow ?? item.to_row ?? -1,
        toCol: to.col ?? to.c ?? item.toCol ?? item.to_col ?? -1,
      };
    }
    return null;
  }).filter(Boolean) as ChessMove[];
}

function parseLastMove(obj: any): ChessMove | null {
  if (!obj) return null;
  const from = obj.from || {};
  const to = obj.to || {};
  const fromRow = from.row ?? from.r ?? obj.fromRow ?? obj.from_row ?? -1;
  const fromCol = from.col ?? from.c ?? obj.fromCol ?? obj.from_col ?? -1;
  const toRow = to.row ?? to.r ?? obj.toRow ?? obj.to_row ?? -1;
  const toCol = to.col ?? to.c ?? obj.toCol ?? obj.to_col ?? -1;
  if (fromRow < 0 || toRow < 0) return null;
  return { fromRow, fromCol, toRow, toCol };
}

function parseLastMoveFromHistory(history: any[] | null): ChessMove | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const last = history[history.length - 1];
  return parseLastMove(last) || parseLastMove(last?.move);
}

function parseCastlingAvailable(data: any): CastlingAvailable {
  const obj = data.castlingAvailable || {};
  return {
    kingSide: !!obj.kingSide,
    queenSide: !!obj.queenSide,
  };
}

function applyCastlingOnBoard(board: ChessCell[][], isWhite: boolean, kingSide: boolean): ChessCell[][] {
  const r = isWhite ? 7 : 0;
  const newBoard = board.map(row => row.map(cell => ({ ...cell })));
  const king = newBoard[r][4]?.piece;
  if (!king || king.type !== ChessPieceType.KING) return board;

  const [kTo, rookFrom, rookTo] = kingSide ? [6, 7, 5] : [2, 0, 3];
  const rook = newBoard[r][rookFrom]?.piece;
  if (!rook || rook.type !== ChessPieceType.ROOK) return board;

  newBoard[r][4].piece = null;
  newBoard[r][rookFrom].piece = null;
  newBoard[r][kTo].piece = king;
  newBoard[r][rookTo].piece = rook;
  return newBoard;
}

function isPawnPromotionMove(board: ChessCell[][], fromRow: number, fromCol: number, toRow: number): boolean {
  const piece = board[fromRow][fromCol].piece;
  if (!piece || piece.type !== ChessPieceType.PAWN) return false;
  return (piece.isWhite && toRow === 0) || (!piece.isWhite && toRow === 7);
}

function submitPlayerMove(fromRow: number, fromCol: number, toRow: number, toCol: number, set: any, get: any) {
  const s = get();
  if (isPawnPromotionMove(s.board, fromRow, fromCol, toRow)) {
    set({
      promotionPending: { fromRow, fromCol, toRow, toCol },
      selectedRow: null,
      selectedCol: null,
    });
    return;
  }
  const roomId = (window as any).currentRoomId;
  if (roomId) sendMove(roomId, fromRow, fromCol, toRow, toCol, null, set);
}

function sendMove(roomId: string, fromRow: number, fromCol: number, toRow: number, toCol: number, promotion: string | null, set: any) {
  (window as any).chessSocket?.move(roomId, fromRow, fromCol, toRow, toCol, promotion);
  set({
    isMovePending: true,
    selectedRow: null,
    selectedCol: null,
    validMoves: [],
    castlingSuppressedForTurn: true,
    promotionPending: null,
  });
}

function startStatusPolling(roomId: string, set: any, get: any) {
  if (statusPollingInterval) clearInterval(statusPollingInterval);
  statusPollingInterval = setInterval(async () => {
    if (get().phase !== ChessPhase.WAITING) {
      clearInterval(statusPollingInterval);
      return;
    }
    try {
      const status = await apiRepository.getRoomStatus(roomId);
      if (status.status === 'started') {
        (window as any).chessSocket?.requestSync(roomId);
        clearInterval(statusPollingInterval);
      }
    } catch {}
  }, 5000);
}
