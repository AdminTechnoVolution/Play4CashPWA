import { create } from 'zustand';
import { HalmaSocketManager } from '../data/network/HalmaSocketManager';
import { apiService } from '../data/network/ApiService';
import { apiRepository } from '../data/network/ApiRepository';
import type { GameOverPayload } from '../data/models/ApiModels';
import { SpectatorPayload } from '../util/SpectatorPayload';
import { thresholdSeconds, triggerTimeoutWarning } from '../ui/game/turnTimeoutAlarm';
import { playerGameEndReasonFallback } from '../i18n/ApiMessageDisplay';

// Mirroring Android: HalmaViewModel.kt
const HALMA_BOARD_SIZE = 8;
const HALMA_DIAGONAL_UNIT_STEPS = [
  { dr: 1, dc: -1 }, { dr: 1, dc: 1 }, { dr: -1, dc: -1 }, { dr: -1, dc: 1 }
];

export enum HalmaPhase { WAITING = 'WAITING', PLAY = 'PLAY', GAME_OVER = 'GAME_OVER' }

export enum HalmaCellState {
  EMPTY = 'EMPTY',
  PLAYER = 'PLAYER',
  OPPONENT = 'OPPONENT',
  PLAYER_KING = 'PLAYER_KING',
  OPPONENT_KING = 'OPPONENT_KING'
}

function isPlayerPiece(s: HalmaCellState): boolean {
  return s === HalmaCellState.PLAYER || s === HalmaCellState.PLAYER_KING;
}

function isKing(s: HalmaCellState): boolean {
  return s === HalmaCellState.PLAYER_KING || s === HalmaCellState.OPPONENT_KING;
}

// Mirrored from HalmaUiState in Android
export interface HalmaUiState {
  phase: HalmaPhase;
  board: HalmaCellState[][];
  isPlayerTurn: boolean;
  turnTimeLeft: number;
  turnTimerTotal: number;
  selectedRow: number | null;
  selectedCol: number | null;
  validMoves: { row: number, col: number }[];
  isContinuingJump: boolean;
  mustEndTurn: boolean;
  isMovePending: boolean;
  statusMessage: string;
  opponentName: string;
  opponentConfirmed: boolean;
  winner: string | null;
  prize: number | null;
  betAmount: number;
  apiErrorRawMessage: string | null;
  navigateBack: boolean;
  matchCancelledMessage: string | null;
  opponentLeftMessage: string | null;
  isLeaving: boolean;
  moveCount: number;
  lastLandedRow: number | null;
  lastLandedCol: number | null;
  jumpTrail: { row: number, col: number }[];
  pendingCaptures: { row: number, col: number }[];
  isSpectator: boolean;
  spectatorsCount: number;
  gameOver: GameOverPayload | null;
  p1Name: string;
  p2Name: string;
  turnHolder: string;
  spectatorCurrentPlayer: string;
  myUsername: string;
  /** True when on-screen light pieces map to server seat P1 (from socket isPlayerOne / is_player_one). */
  boardViewAsPlayerOne: boolean;
}

interface HalmaStoreActions {
  initGame: (roomId: string, myUsername: string, bet: number, hasOpponent: boolean, initialOpponentName: string, isSpectator: boolean) => void;
  cleanup: () => void;
  onCellTap: (row: number, col: number, roomId: string) => void;
  endTurnManually: (roomId: string) => void;
  clearError: () => void;
  clearOpponentLeft: () => void;
  leaveRoom: (roomId: string) => void;
}

const INITIAL_STATE: HalmaUiState = {
  phase: HalmaPhase.WAITING,
  board: Array.from({ length: HALMA_BOARD_SIZE }, () => Array(HALMA_BOARD_SIZE).fill(HalmaCellState.EMPTY)),
  isPlayerTurn: false,
  turnTimeLeft: 0,
  turnTimerTotal: 0,
  selectedRow: null,
  selectedCol: null,
  validMoves: [],
  isContinuingJump: false,
  mustEndTurn: false,
  isMovePending: false,
  statusMessage: '',
  opponentName: '',
  opponentConfirmed: false,
  winner: null,
  prize: null,
  betAmount: 0,
  apiErrorRawMessage: null,
  navigateBack: false,
  matchCancelledMessage: null,
  opponentLeftMessage: null,
  isLeaving: false,
  moveCount: 0,
  lastLandedRow: null,
  lastLandedCol: null,
  jumpTrail: [],
  pendingCaptures: [],
  isSpectator: false,
  spectatorsCount: 0,
  gameOver: null,
  p1Name: '',
  p2Name: '',
  turnHolder: '',
  spectatorCurrentPlayer: '',
  myUsername: '',
  boardViewAsPlayerOne: true,
};

export const useHalmaStore = create<HalmaUiState & HalmaStoreActions>((set, get) => {
  let socketManager: HalmaSocketManager | null = null;
  let pollingInterval: any = null;
  let turnTimerInterval: any = null;
  let isPlayerOne = true; // authoritative from socket
  let jumpTrailAccumulator: { row: number, col: number }[] = [];
  let halmaCountdownTimeoutWarned = false;

  const startCountdown = (seconds: number) => {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    halmaCountdownTimeoutWarned = false;
    const cap = Math.max(0, seconds);
    set({ turnTimeLeft: Math.max(0, seconds) });

    queueMicrotask(() => {
      const s = get();
      if (!s.isPlayerTurn || s.isSpectator) return;
      const th = thresholdSeconds(cap);
      if (cap > 0 && cap <= th && !halmaCountdownTimeoutWarned) {
        triggerTimeoutWarning();
        halmaCountdownTimeoutWarned = true;
      }
    });

    turnTimerInterval = setInterval(() => {
      set((state) => {
        const current = state.turnTimeLeft;
        if (current <= 0) {
          if (turnTimerInterval) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
          }
          return state;
        }
        const prev = current;
        const next = current - 1;
        if (state.isPlayerTurn && !state.isSpectator && !halmaCountdownTimeoutWarned) {
          const th = thresholdSeconds(cap);
          if (cap > th && prev > th && next <= th) {
            triggerTimeoutWarning();
            halmaCountdownTimeoutWarned = true;
          }
        }
        return { turnTimeLeft: next };
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
  };

  // Helper functions ported from Android
  const isDarkSquare = (row: number, col: number) => (row + col) % 2 !== 0;

  const toRawCoord = (displayRow: number, displayCol: number): { row: number, col: number } => {
    if (isPlayerOne) return { row: displayRow, col: displayCol };
    return { row: HALMA_BOARD_SIZE - 1 - displayRow, col: HALMA_BOARD_SIZE - 1 - displayCol };
  };

  const rawToDisplayCoord = (rawRow: number, rawCol: number): { row: number, col: number } => {
    if (isPlayerOne) return { row: rawRow, col: rawCol };
    return { row: HALMA_BOARD_SIZE - 1 - rawRow, col: HALMA_BOARD_SIZE - 1 - rawCol };
  };

  const findLandedCell = (oldBoard: HalmaCellState[][], newBoard: HalmaCellState[][]) => {
    const landed: { row: number, col: number }[] = [];
    for (let r = 0; r < HALMA_BOARD_SIZE; r++) {
      for (let c = 0; c < HALMA_BOARD_SIZE; c++) {
        if (oldBoard[r][c] === HalmaCellState.EMPTY && newBoard[r][c] !== HalmaCellState.EMPTY) {
          landed.push({ row: r, col: c });
        }
      }
    }
    return landed.length === 1 ? landed[0] : null;
  };

  const cellsStrictlyBetween = (fR: number, fC: number, tR: number, tC: number) => {
    const dr = tR - fR;
    const dc = tC - fC;
    const steps = Math.abs(dr);
    if (steps !== Math.abs(dc) || steps === 0) return [];
    const stepR = dr / steps;
    const stepC = dc / steps;
    return Array.from({ length: steps - 1 }, (_, i) => ({ row: fR + stepR * (i + 1), col: fC + stepC * (i + 1) }));
  };

  const parseBoard = (arr: any[]): HalmaCellState[][] | null => {
    if (!arr || arr.length !== HALMA_BOARD_SIZE) return null;
    const raw = arr.map((rowJson: any[]) => {
      return rowJson.map((val: number) => {
        switch (val) {
          case 1: return isPlayerOne ? HalmaCellState.PLAYER : HalmaCellState.OPPONENT;
          case 2: return isPlayerOne ? HalmaCellState.OPPONENT : HalmaCellState.PLAYER;
          case 3: return isPlayerOne ? HalmaCellState.PLAYER_KING : HalmaCellState.OPPONENT_KING;
          case 4: return isPlayerOne ? HalmaCellState.OPPONENT_KING : HalmaCellState.PLAYER_KING;
          default: return HalmaCellState.EMPTY;
        }
      });
    });
    return isPlayerOne ? raw : [...raw].reverse().map(row => [...row].reverse());
  };

  const getNormalPieceMoves = (fromRow: number, fromCol: number, board: HalmaCellState[][]) => {
    const moves: { row: number, col: number }[] = [];
    for (const { dr, dc } of HALMA_DIAGONAL_UNIT_STEPS) {
      const tr = fromRow + dr;
      const tc = fromCol + dc;
      if (tr >= 0 && tr < HALMA_BOARD_SIZE && tc >= 0 && tc < HALMA_BOARD_SIZE && board[tr][tc] === HalmaCellState.EMPTY && isDarkSquare(tr, tc)) {
        moves.push({ row: tr, col: tc });
      }
      const midR = fromRow + dr;
      const midC = fromCol + dc;
      const tr2 = fromRow + dr * 2;
      const tc2 = fromCol + dc * 2;
      if (tr2 >= 0 && tr2 < HALMA_BOARD_SIZE && tc2 >= 0 && tc2 < HALMA_BOARD_SIZE && midR >= 0 && midR < HALMA_BOARD_SIZE && midC >= 0 && midC < HALMA_BOARD_SIZE && board[midR][midC] !== HalmaCellState.EMPTY && board[tr2][tc2] === HalmaCellState.EMPTY && isDarkSquare(tr2, tc2)) {
        moves.push({ row: tr2, col: tc2 });
      }
    }
    return moves;
  };

  const getKingSlides = (fromRow: number, fromCol: number, board: HalmaCellState[][]) => {
    const moves: { row: number, col: number }[] = [];
    for (const { dr, dc } of HALMA_DIAGONAL_UNIT_STEPS) {
      let t = 1;
      while (true) {
        const r = fromRow + dr * t;
        const c = fromCol + dc * t;
        if (r < 0 || r >= HALMA_BOARD_SIZE || c < 0 || c >= HALMA_BOARD_SIZE) break;
        if (board[r][c] === HalmaCellState.EMPTY && isDarkSquare(r, c)) {
          moves.push({ row: r, col: c });
          t++;
        } else break;
      }
    }
    return moves;
  };

  const getValidJumpsOnly = (fromRow: number, fromCol: number, board: HalmaCellState[][]) => {
    const moves: { row: number, col: number }[] = [];
    for (const { dr, dc } of HALMA_DIAGONAL_UNIT_STEPS) {
      const midR = fromRow + dr;
      const midC = fromCol + dc;
      const tr2 = fromRow + dr * 2;
      const tc2 = fromCol + dc * 2;
      if (tr2 >= 0 && tr2 < HALMA_BOARD_SIZE && tc2 >= 0 && tc2 < HALMA_BOARD_SIZE && midR >= 0 && midR < HALMA_BOARD_SIZE && midC >= 0 && midC < HALMA_BOARD_SIZE && board[midR][midC] !== HalmaCellState.EMPTY && board[tr2][tc2] === HalmaCellState.EMPTY && isDarkSquare(tr2, tc2)) {
        moves.push({ row: tr2, col: tc2 });
      }
    }
    return moves;
  };

  const getValidKingJumpMovesOnly = (fromRow: number, fromCol: number, board: HalmaCellState[][]) => {
    const moves: { row: number, col: number }[] = [];
    for (const { dr, dc } of HALMA_DIAGONAL_UNIT_STEPS) {
      let t = 1;
      while (true) {
        const r = fromRow + dr * t;
        const c = fromCol + dc * t;
        if (r < 0 || r >= HALMA_BOARD_SIZE || c < 0 || c >= HALMA_BOARD_SIZE) break;
        if (board[r][c] !== HalmaCellState.EMPTY) {
          let u = t + 1;
          while (true) {
            const r2 = fromRow + dr * u;
            const c2 = fromCol + dc * u;
            if (r2 < 0 || r2 >= HALMA_BOARD_SIZE || c2 < 0 || c2 >= HALMA_BOARD_SIZE) break;
            if (board[r2][c2] === HalmaCellState.EMPTY && isDarkSquare(r2, c2)) {
              moves.push({ row: r2, col: c2 });
              u++;
            } else break;
          }
          break;
        }
        t++;
      }
    }
    return moves;
  };

  return {
    ...INITIAL_STATE,

    initGame(roomId, myUsername, bet, hasOpponent, initialOpponentName, isSpectator) {
      isPlayerOne = true;
      set({ 
        ...INITIAL_STATE, 
        betAmount: bet, 
        opponentConfirmed: hasOpponent || isSpectator, 
        opponentName: initialOpponentName, 
        isSpectator,
        myUsername,
        boardViewAsPlayerOne: true,
        statusMessage: isSpectator ? 'spectator_watching_status' : (hasOpponent ? 'halma_opponent_joined' : 'status_waiting_opponent')
      });

      // Polling mirrored from Android (HalmaViewModel.kt:150)
      if (!isSpectator) {
        pollingInterval = window.setInterval(async () => {
          if (get().phase !== HalmaPhase.WAITING) return;
          try {
            const res = await apiService.getRoomStatus(roomId);
            if (res.status === 'started') {
              socketManager?.requestSync(roomId);
            }
          } catch {}
        }, 5000);
      }

      socketManager = new HalmaSocketManager();
      
      socketManager.connect(roomId);
      if (hasOpponent && !isSpectator) {
        apiRepository.readyRoom(roomId).catch(() => {});
        socketManager.requestSync(roomId);
      }
      if (isSpectator) {
        setTimeout(() => {
          if (get().phase === HalmaPhase.WAITING) socketManager?.requestSync(roomId);
        }, 1500);
      }
      
      socketManager.onGameUpdate((json: any) => {
        const data = json.data || json;

        // ── Spectator refresh: extract player names + turn holder from every event ──
        // Mirrors Android update (Battleship/Halma parity)
        const isSpectator = get().isSpectator;
        if (isSpectator) {
          const { p1: ep1, p2: ep2, turnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);
          const nameUpdates: any = {};
          if (ep1) nameUpdates.p1Name = ep1;
          if (ep2) nameUpdates.p2Name = ep2;
          if (turnHolder) nameUpdates.spectatorCurrentPlayer = turnHolder;
          if (Object.keys(nameUpdates).length > 0) set(nameUpdates);
        }

        // Literal translation of handleHalmaMessage (Android 255-450)
        const opponentJoined = data.opponentJoined || data.opponent_joined || false;
        const opponentName = data.opponentName || data.userName || '';
        const outcome = data.outcome || '';
        const isDraw = data.isDraw || data.draw || false;
        
        if (data.isPlayerOne !== undefined) {
          isPlayerOne = data.isPlayerOne;
          set({ boardViewAsPlayerOne: data.isPlayerOne });
        } else if (data.is_player_one !== undefined) {
          isPlayerOne = data.is_player_one;
          set({ boardViewAsPlayerOne: data.is_player_one });
        }

        if (opponentJoined && opponentName) {
          set({ opponentConfirmed: true, opponentName });
          if (!isSpectator) apiRepository.readyRoom(roomId).catch(() => {});
        }

        // Android match end logic (HalmaViewModel.kt:344) — Standardized Parity
        const gameEndedRaw = data.gameEnded || data.game_ended || false;
        if (gameEndedRaw || outcome === 'win' || outcome === 'lose' || outcome === 'timeout_loss' ||
            outcome === 'opponent_disconnected' || outcome === 'forfeit' || isDraw) {
          
          if (pollingInterval) clearInterval(pollingInterval);
          stopCountdown();
          
          const myUsername = ''; // Halma store doesn't seem to store myUsername in the closure or I missed it? Wait.
          // Re-checking... ah, 'myUsername' is passed in initGame.
          // Let's use the standard resolver.
          const gameOver = SpectatorPayload.resolveStandardGameOver(data, get().myUsername, isSpectator, 'HALMA');

          set({
            phase: HalmaPhase.GAME_OVER,
            gameOver,
            isMovePending: false
          });
          return;
        }

        const newBoard = parseBoard(data.board);
        const yourTurn = data.yourTurn || data.your_turn || false;
        const timerSeconds = data.turnTimerSeconds ?? data.turn_timer_seconds ?? data.turn_timer ?? data.turnTimeLeft ?? data.turn_time_left ?? 0;
        const mustEndTurn = data.mustEndTurn ?? data.must_end_turn ?? false;
        const continuingJump = data.continuingJump ?? data.continuing_jump ?? false;
        const jumpingPiece = data.jumpingPiece || data.jumping_piece;

        if (newBoard) {
          const landed = findLandedCell(get().board, newBoard);
          if (landed) jumpTrailAccumulator.push(landed);
          
          if (mustEndTurn) {
            // Android 389: mustEndTurn
            const trail = [...jumpTrailAccumulator];
            jumpTrailAccumulator = [];

            const { p1, p2, turnHolder: syncTurnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);

            set({
              phase: HalmaPhase.PLAY,
              board: newBoard,
              isPlayerTurn: !isSpectator,
              turnTimeLeft: timerSeconds,
              selectedRow: null,
              selectedCol: null,
              validMoves: [],
              isContinuingJump: false,
              mustEndTurn: !isSpectator,
              isMovePending: false,
              p1Name: p1,
              p2Name: p2,
              turnHolder: syncTurnHolder,
              statusMessage: isSpectator 
                ? `spectator_turn_of_x|${syncTurnHolder}` 
                : (isSpectator ? '' : 'halma_must_end_turn'),
              moveCount: get().moveCount + 1,
              lastLandedRow: landed?.row || null,
              lastLandedCol: landed?.col || null,
              jumpTrail: trail,
            });
            return;
          }

          if (continuingJump && jumpingPiece) {
            // Android 417: continuingJump
            const rawR = jumpingPiece.row !== undefined ? jumpingPiece.row : jumpingPiece.r;
            const rawC = jumpingPiece.col !== undefined ? jumpingPiece.col : jumpingPiece.c;
            const r = isPlayerOne ? rawR : 7 - rawR;
            const c = isPlayerOne ? rawC : 7 - rawC;

            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
              const piece = newBoard[r][c];
              const jumpMoves = (piece === HalmaCellState.PLAYER_KING || piece === HalmaCellState.OPPONENT_KING)
                ? getValidKingJumpMovesOnly(r, c, newBoard)
                : getValidJumpsOnly(r, c, newBoard);

              if (jumpMoves.length === 0) {
                // Android 429: No more jumps -> end turn automatically
                if (!isSpectator) socketManager?.endTurn(roomId);
                set({
                  phase: HalmaPhase.PLAY,
                  board: newBoard,
                  isPlayerTurn: !isSpectator,
                  turnTimeLeft: timerSeconds,
                  selectedRow: null,
                  selectedCol: null,
                  validMoves: [],
                  isContinuingJump: false,
                  mustEndTurn: !isSpectator,
                  isMovePending: false,
                  moveCount: get().moveCount + 1,
                });
              } else {
                set({
                  phase: HalmaPhase.PLAY,
                  board: newBoard,
                  isPlayerTurn: !isSpectator,
                  turnTimeLeft: timerSeconds,
                  selectedRow: r,
                  selectedCol: c,
                  validMoves: jumpMoves,
                  isContinuingJump: !isSpectator,
                  mustEndTurn: false,
                  isMovePending: false,
                  moveCount: get().moveCount + 1,
                });
              }
            }
            return;
          }

          // Default / Turn Flip branch (Android 469+)
          const trail = [...jumpTrailAccumulator];
          jumpTrailAccumulator = [];

          const { p1, p2, turnHolder: syncTurnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);
          
          set({
            phase: HalmaPhase.PLAY,
            board: newBoard,
            isPlayerTurn: yourTurn && !isSpectator,
            turnTimeLeft: timerSeconds,
            selectedRow: null,
            selectedCol: null,
            validMoves: [],
            isContinuingJump: false,
            mustEndTurn: false,
            isMovePending: false,
            p1Name: p1,
            p2Name: p2,
            turnHolder: syncTurnHolder,
            statusMessage: isSpectator 
              ? `spectator_turn_of_x|${syncTurnHolder}`
              : (yourTurn ? 'halma_your_turn' : `bs_named_opponent_turn|${syncTurnHolder || get().opponentName}`),
            moveCount: get().moveCount + 1,
            lastLandedRow: landed?.row || null,
            lastLandedCol: landed?.col || null,
            jumpTrail: trail,
          });

          if (timerSeconds > 0) {
            const current = get().turnTimeLeft;
            // Only restart if the difference is significant (> 2s) to maintain a smooth local tick
            if (Math.abs(current - timerSeconds) > 2 || !turnTimerInterval) {
              startCountdown(timerSeconds);
            }
          }
        }
      });
    },

    onCellTap(row, col, roomId) {
      const state = get();
      if (state.isSpectator || state.phase !== HalmaPhase.PLAY || !state.isPlayerTurn || state.isMovePending || state.mustEndTurn) return;

      const isValid = state.validMoves.some(m => m.row === row && m.col === col);
      if (state.selectedRow !== null && state.selectedCol !== null && isValid) {
        const rawFrom = toRawCoord(state.selectedRow, state.selectedCol);
        const rawTo = toRawCoord(row, col);
        socketManager?.move(roomId, rawFrom.row, rawFrom.col, rawTo.row, rawTo.col);
        set({ isMovePending: true });
      } else {
        const piece = state.board[row][col];
        if (isPlayerPiece(piece)) {
          const moves = isKing(piece) ? [...getKingSlides(row, col, state.board), ...getValidKingJumpMovesOnly(row, col, state.board)] : getNormalPieceMoves(row, col, state.board);
          set({ selectedRow: row, selectedCol: col, validMoves: moves });
        } else {
          set({ selectedRow: null, selectedCol: null, validMoves: [] });
        }
      }
    },

    endTurnManually(roomId) {
      const state = get();
      if (state.isSpectator || state.phase !== HalmaPhase.PLAY || !state.isPlayerTurn || state.isMovePending) return;
      socketManager?.endTurn(roomId);
      set({ isMovePending: true, selectedRow: null, selectedCol: null, validMoves: [], isContinuingJump: false, mustEndTurn: false });
    },

    cleanup() {
      if (pollingInterval) clearInterval(pollingInterval);
      stopCountdown();
      socketManager?.disconnect();
      socketManager = null;
      isPlayerOne = true;
      set(INITIAL_STATE);
    },

    clearError() { set({ apiErrorRawMessage: null }); },
    clearOpponentLeft() { set({ opponentLeftMessage: null }); },
    leaveRoom(roomId) {
      apiRepository.leaveRoom(roomId).catch(() => {});
      get().cleanup();
      set({ navigateBack: true });
    }
  };
});
