import { create } from 'zustand';
import { ChessSocketManager } from '../data/network/ChessSocketManager';
import type { ChessPiece, ChessState, GameOverPayload } from '../data/models/ApiModels';

const EMPTY_BOARD = (): ChessPiece[][] =>
  Array.from({ length: 8 }, () => Array(8).fill(null));

const INITIAL_BOARD = (): ChessPiece[][] => {
  const b = EMPTY_BOARD();
  const backRank: ChessPiece[] = ['R','N','B','Q','K','B','N','R'].map((p) => `b${p}` as ChessPiece);
  b[0] = backRank;
  b[1] = Array(8).fill('bP');
  b[6] = Array(8).fill('wP');
  b[7] = ['wR','wN','wB','wQ','wK','wB','wN','wR'];
  return b;
};

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

interface ChessStoreState {
  board: ChessPiece[][];
  myColor: 'white' | 'black';
  currentPlayer: 'white' | 'black';
  myUsername: string;
  selectedCell: { row: number; col: number } | null;
  validMoves: { row: number; col: number }[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  canCastleKingside: boolean;
  canCastleQueenside: boolean;
  promotionPending: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  gameOver: GameOverPayload | null;
  error: string | null;
  socket: ChessSocketManager | null;
}

interface ChessStoreActions {
  initGame: (roomId: string, myColor: 'white' | 'black', myUsername: string) => void;
  cleanup: () => void;
  selectCell: (row: number, col: number, roomId: string) => void;
  setPromotion: (roomId: string, piece: PromotionPiece) => void;
  clearError: () => void;
}

type ChessStore = ChessStoreState & ChessStoreActions;

function isMyPiece(cell: ChessPiece, color: 'white' | 'black'): boolean {
  if (!cell) return false;
  return color === 'white' ? cell.startsWith('w') : cell.startsWith('b');
}

// Simple client-side valid moves (server validates; this is for highlight only)
function computeValidMoves(
  board: ChessPiece[][],
  row: number,
  col: number,
  color: 'white' | 'black'
): { row: number; col: number }[] {
  const piece = board[row][col];
  if (!piece) return [];
  const moves: { row: number; col: number }[] = [];
  const enemy = color === 'white' ? 'b' : 'w';
  const ally = color === 'white' ? 'w' : 'b';
  const type = piece[1];

  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const isEmpty = (r: number, c: number) => inBounds(r, c) && !board[r][c];
  const isEnemy = (r: number, c: number) => inBounds(r, c) && board[r][c]?.startsWith(enemy);
  const isAlly = (r: number, c: number) => inBounds(r, c) && board[r][c]?.startsWith(ally);
  const canLand = (r: number, c: number) => inBounds(r, c) && !isAlly(r, c);

  const addSlide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && !isAlly(r, c)) {
      moves.push({ row: r, col: c });
      if (isEnemy(r, c)) break;
      r += dr; c += dc;
    }
  };

  switch (type) {
    case 'P': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      if (isEmpty(row + dir, col)) {
        moves.push({ row: row + dir, col });
        if (row === startRow && isEmpty(row + 2 * dir, col)) moves.push({ row: row + 2 * dir, col });
      }
      [-1, 1].forEach((dc) => { if (isEnemy(row + dir, col + dc)) moves.push({ row: row + dir, col: col + dc }); });
      break;
    }
    case 'N':
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
        if (canLand(row+dr, col+dc)) moves.push({ row: row+dr, col: col+dc });
      });
      break;
    case 'B':
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc]) => addSlide(dr, dc));
      break;
    case 'R':
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc]) => addSlide(dr, dc));
      break;
    case 'Q':
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => addSlide(dr, dc));
      break;
    case 'K':
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => {
        if (canLand(row+dr, col+dc)) moves.push({ row: row+dr, col: col+dc });
      });
      break;
  }
  return moves;
}

export const useChessStore = create<ChessStore>((set, get) => ({
  board: INITIAL_BOARD(),
  myColor: 'white',
  currentPlayer: 'white',
  myUsername: '',
  selectedCell: null,
  validMoves: [],
  isCheck: false,
  isCheckmate: false,
  isStalemate: false,
  canCastleKingside: false,
  canCastleQueenside: false,
  promotionPending: null,
  gameOver: null,
  error: null,
  socket: null,

  initGame(roomId, myColor, myUsername) {
    const socket = new ChessSocketManager();
    socket.connect(roomId);
    socket.onGameUpdate((state: ChessState) => {
      set({
        board: state.board,
        currentPlayer: state.currentPlayer,
        myColor: state.myColor ?? myColor,
        isCheck: state.isCheck,
        isCheckmate: state.isCheckmate,
        isStalemate: state.isStalemate,
        canCastleKingside: state.canCastleKingside,
        canCastleQueenside: state.canCastleQueenside,
        gameOver: state.gameOver ?? null,
        selectedCell: null,
        validMoves: [],
      });
    });
    set({ socket, myColor, myUsername });
  },

  cleanup() {
    get().socket?.disconnect();
    set({ socket: null, board: INITIAL_BOARD(), gameOver: null, selectedCell: null, validMoves: [] });
  },

  selectCell(row, col, roomId) {
    const { board, myColor, currentPlayer, selectedCell, validMoves, socket, promotionPending } = get();
    if (promotionPending || !socket) return;
    const isMyTurn = currentPlayer === myColor;

    if (selectedCell) {
      const isValidTarget = validMoves.some((m) => m.row === row && m.col === col);
      if (isValidTarget) {
        const piece = board[selectedCell.row][selectedCell.col];
        // Check pawn promotion
        const isPromotion =
          piece === 'wP' && row === 0 ||
          piece === 'bP' && row === 7;
        if (isPromotion) {
          set({ promotionPending: { from: selectedCell, to: { row, col } }, selectedCell: null, validMoves: [] });
          return;
        }
        socket.move(roomId, selectedCell, { row, col });
        set({ selectedCell: null, validMoves: [] });
        return;
      }
      // Deselect or select new piece
      if (isMyPiece(board[row][col], myColor) && isMyTurn) {
        const moves = computeValidMoves(board, row, col, myColor);
        set({ selectedCell: { row, col }, validMoves: moves });
      } else {
        set({ selectedCell: null, validMoves: [] });
      }
      return;
    }

    if (!isMyTurn) return;
    if (!isMyPiece(board[row][col], myColor)) return;
    const moves = computeValidMoves(board, row, col, myColor);
    set({ selectedCell: { row, col }, validMoves: moves });
  },

  setPromotion(roomId, piece) {
    const { promotionPending, socket } = get();
    if (!promotionPending || !socket) return;
    socket.move(roomId, promotionPending.from, promotionPending.to, piece);
    set({ promotionPending: null });
  },

  clearError() { set({ error: null }); },
}));
