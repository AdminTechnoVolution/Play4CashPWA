import { create } from 'zustand';
import { HalmaSocketManager } from '../data/network/HalmaSocketManager';
import type { HalmaCell, HalmaState, GameOverPayload } from '../data/models/ApiModels';

const EMPTY_BOARD = (): HalmaCell[][] =>
  Array.from({ length: 8 }, () => Array(8).fill('empty') as HalmaCell[]);

const isDark = (r: number, c: number) => (r + c) % 2 !== 0;

// Diagonal directions for halma
const DIAGS = [[-1,-1],[-1,1],[1,-1],[1,1]] as const;

function computeValidMoves(
  board: HalmaCell[][],
  row: number,
  col: number,
  visited: Set<string>
): { row: number; col: number; isJump: boolean }[] {
  const moves: { row: number; col: number; isJump: boolean }[] = [];
  for (const [dr, dc] of DIAGS) {
    const nr = row + dr, nc = col + dc;
    // Single step
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && isDark(nr, nc) && board[nr][nc] === 'empty') {
      moves.push({ row: nr, col: nc, isJump: false });
    }
    // Jump
    const jr = row + 2 * dr, jc = col + 2 * dc;
    const key = `${jr},${jc}`;
    if (
      nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] !== 'empty' &&
      jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && isDark(jr, jc) && board[jr][jc] === 'empty' &&
      !visited.has(key)
    ) {
      moves.push({ row: jr, col: jc, isJump: true });
    }
  }
  return moves;
}

interface HalmaStoreState {
  board: HalmaCell[][];
  currentPlayer: string;
  myUsername: string;
  selectedCell: { row: number; col: number } | null;
  validMoves: { row: number; col: number; isJump: boolean }[];
  jumpTrail: { row: number; col: number }[];
  inJumpSequence: boolean;
  gameOver: GameOverPayload | null;
  error: string | null;
  socket: HalmaSocketManager | null;
}

interface HalmaStoreActions {
  initGame: (roomId: string, myUsername: string) => void;
  cleanup: () => void;
  cellTapped: (row: number, col: number, roomId: string) => void;
  endTurn: (roomId: string) => void;
  clearError: () => void;
}

export const useHalmaStore = create<HalmaStoreState & HalmaStoreActions>((set, get) => ({
  board: EMPTY_BOARD(),
  currentPlayer: '',
  myUsername: '',
  selectedCell: null,
  validMoves: [],
  jumpTrail: [],
  inJumpSequence: false,
  gameOver: null,
  error: null,
  socket: null,

  initGame(roomId, myUsername) {
    const socket = new HalmaSocketManager();
    socket.connect(roomId);
    socket.onGameUpdate((state: HalmaState) => {
      set({
        board: state.board,
        currentPlayer: state.currentPlayer,
        myUsername: state.myUsername || myUsername,
        gameOver: state.gameOver ?? null,
        selectedCell: null,
        validMoves: [],
        jumpTrail: [],
        inJumpSequence: false,
      });
    });
    set({ socket, myUsername });
  },

  cleanup() {
    get().socket?.disconnect();
    set({ socket: null, board: EMPTY_BOARD(), gameOver: null, selectedCell: null, validMoves: [], jumpTrail: [], inJumpSequence: false });
  },

  cellTapped(row, col, roomId) {
    const { board, currentPlayer, myUsername, selectedCell, validMoves, inJumpSequence, jumpTrail, socket } = get();
    if (!socket || currentPlayer !== myUsername) return;

    if (selectedCell) {
      const target = validMoves.find((m) => m.row === row && m.col === col);
      if (target) {
        // Execute move
        socket.move(roomId, selectedCell.row, selectedCell.col, row, col);
        const isJump = target.isJump;

        if (isJump) {
          const newBoard = board.map((r) => [...r]) as HalmaCell[][];
          newBoard[row][col] = newBoard[selectedCell.row][selectedCell.col];
          newBoard[selectedCell.row][selectedCell.col] = 'empty';
          const visited = new Set(jumpTrail.map((c) => `${c.row},${c.col}`));
          visited.add(`${row},${col}`);
          const furtherJumps = computeValidMoves(newBoard, row, col, visited).filter((m) => m.isJump);
          if (furtherJumps.length > 0) {
            set({
              board: newBoard,
              selectedCell: { row, col },
              validMoves: furtherJumps,
              jumpTrail: [...jumpTrail, { row: selectedCell.row, col: selectedCell.col }],
              inJumpSequence: true,
            });
          } else {
            set({ selectedCell: null, validMoves: [], jumpTrail: [], inJumpSequence: false });
          }
        } else {
          set({ selectedCell: null, validMoves: [], jumpTrail: [], inJumpSequence: false });
        }
        return;
      }
      // Clicking own piece again — reselect
    }

    if (board[row]?.[col] !== 'mine') return;
    const moves = computeValidMoves(board, row, col, new Set());
    set({ selectedCell: { row, col }, validMoves: moves, jumpTrail: [], inJumpSequence: false });
  },

  endTurn(roomId) {
    get().socket?.endTurn(roomId);
    set({ selectedCell: null, validMoves: [], jumpTrail: [], inJumpSequence: false });
  },

  clearError() { set({ error: null }); },
}));
