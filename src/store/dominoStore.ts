import { create } from 'zustand';
import { DominoSocketManager } from '../data/network/DominoSocketManager';
import type { DominoTile, DominoBoardTile, DominoState, GameOverPayload } from '../data/models/ApiModels';

interface DominoStoreState {
  myHand: DominoTile[];
  opponents: { username: string; tileCount: number }[];
  board: DominoBoardTile[];
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
}

interface DominoStoreActions {
  initGame: (roomId: string, myUsername: string) => void;
  cleanup: () => void;
  selectTile: (tile: DominoTile | null) => void;
  playSide: (roomId: string, tile: DominoTile, side: 'left' | 'right') => void;
  draw: (roomId: string) => void;
  pass: (roomId: string) => void;
  clearError: () => void;
}

function computeValidMoves(hand: DominoTile[], leftEnd: number, rightEnd: number, boardEmpty: boolean) {
  return hand.map((tile) => {
    if (boardEmpty) return { tile, sides: ['left' as const] };
    const sides: ('left' | 'right')[] = [];
    if (tile.a === leftEnd || tile.b === leftEnd) sides.push('left');
    if (tile.a === rightEnd || tile.b === rightEnd) sides.push('right');
    return { tile, sides };
  }).filter((m) => m.sides.length > 0);
}

export const useDominoStore = create<DominoStoreState & DominoStoreActions>((set, get) => ({
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
  sidePickTile: null,
  validMoves: [],
  gameOver: null,
  error: null,
  socket: null,

  initGame(roomId, myUsername) {
    const socket = new DominoSocketManager();
    socket.connect(roomId);
    socket.onGameUpdate((state: DominoState) => {
      const valid = computeValidMoves(state.myHand, state.leftEnd, state.rightEnd, state.board.length === 0);
      set({
        myHand: state.myHand,
        opponents: state.opponents,
        board: state.board,
        leftEnd: state.leftEnd,
        rightEnd: state.rightEnd,
        boneyardCount: state.boneyardCount,
        currentPlayer: state.currentPlayer,
        myUsername: state.myUsername || myUsername,
        validMoves: valid,
        gameOver: state.gameOver ?? null,
        selectedTile: null,
        sidePickTile: null,
      });
    });
    set({ socket, myUsername });
  },

  cleanup() {
    get().socket?.disconnect();
    set({ socket: null, myHand: [], board: [], gameOver: null });
  },

  selectTile(tile) {
    if (!tile) { set({ selectedTile: null, sidePickTile: null }); return; }
    const { validMoves, currentPlayer, myUsername } = get();
    if (currentPlayer !== myUsername) return;
    const vm = validMoves.find((m) => m.tile.a === tile.a && m.tile.b === tile.b);
    if (!vm || vm.sides.length === 0) return;
    if (vm.sides.length === 1) {
      set({ selectedTile: tile, selectedSide: vm.sides[0], sidePickTile: null });
    } else {
      set({ sidePickTile: tile, selectedTile: null });
    }
  },

  playSide(roomId, tile, side) {
    const { socket } = get();
    socket?.playTile(roomId, [tile.a, tile.b], side);
    set({ selectedTile: null, selectedSide: null, sidePickTile: null });
  },

  draw(roomId) {
    get().socket?.draw(roomId);
  },

  pass(roomId) {
    get().socket?.pass(roomId);
  },

  clearError() { set({ error: null }); },
}));
