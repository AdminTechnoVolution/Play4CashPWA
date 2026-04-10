import { create } from 'zustand';
import { DominoSocketManager } from '../data/network/DominoSocketManager';
import type { DominoTile, DominoBoardTile, DominoState, GameOverPayload } from '../data/models/ApiModels';
import { SpectatorPayload } from '../util/SpectatorPayload';

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
  isSpectator: boolean;
  p1Name: string;
  p2Name: string;
  turnHolder: string;
  spectatorCurrentPlayer: string;
  turnTimeLeft: number;
  turnTimerTotal: number;
  statusMessage: string;
  spectatorsCount: number;
}

interface DominoStoreActions {
  initGame: (roomId: string, myUsername: string, isSpectator?: boolean) => void;
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
  isSpectator: false,
  p1Name: '',
  p2Name: '',
  turnHolder: '',
  spectatorCurrentPlayer: '',
  turnTimeLeft: 0,
  turnTimerTotal: 0,
  statusMessage: '',
  spectatorsCount: 0,
 
  initGame(roomId, myUsername, isSpectator = false) {
    if (!roomId) return;
    set({ statusMessage: isSpectator ? 'spectator_waiting_next_move' : 'domino_status_waiting_opponent' });
    const socket = new DominoSocketManager();
    socket.connect(roomId);
    socket.onGameUpdate((state: DominoState) => {
      // ── Spectator refresh: extract player names + turn holder from every event ──
      const { p1: ep1, p2: ep2, turnHolder } = SpectatorPayload.extractStandardTurnAndNames(state);
      if (get().isSpectator) {
        const nameUpdates: any = {};
        if (ep1) nameUpdates.p1Name = ep1;
        if (ep2) nameUpdates.p2Name = ep2;
        if (turnHolder) nameUpdates.spectatorCurrentPlayer = turnHolder;
        if (Object.keys(nameUpdates).length > 0) set(nameUpdates);
      }
 
      const valid = computeValidMoves(
        state?.myHand || [], 
        state?.leftEnd ?? -1, 
        state?.rightEnd ?? -1, 
        (state?.board || []).length === 0
      );
 
      const currentPlayer = state.currentPlayer || '';
      const isMyTurn = currentPlayer === myUsername;
 
      set({
        myHand: state.myHand || [],
        opponents: state.opponents || [],
        board: state.board || [],
        leftEnd: state.leftEnd ?? -1,
        rightEnd: state.rightEnd ?? -1,
        boneyardCount: state.boneyardCount ?? 0,
        currentPlayer,
        myUsername: state.myUsername || myUsername,
        turnTimeLeft: (state as any).turnTimerSeconds ?? (state as any).turn_timer_seconds ?? (state as any).turn_timer ?? (state as any).turnTimeLeft ?? (state as any).turn_time_left ?? 0,
        turnTimerTotal: (state as any).turnTimerSeconds ?? (state as any).turn_timer_seconds ?? 60,
        validMoves: valid,
        spectatorsCount: (state as any).spectatorsCount ?? (state as any).spectators_count ?? get().spectatorsCount,
        p1Name: ep1,
        p2Name: ep2,
        turnHolder,
        statusMessage: get().isSpectator 
          ? `spectator_turn_of_x|${turnHolder}`
          : (isMyTurn ? 'domino_your_turn' : `domino_opponent_turn|${turnHolder}`),
        gameOver: SpectatorPayload.resolveStandardGameOver(state, myUsername, get().isSpectator, 'DOMINO'),
        selectedTile: null,
        sidePickTile: null,
      });
    });
    set({ socket, myUsername, isSpectator });
  },

  cleanup() {
    get().socket?.disconnect();
    set({ socket: null, myHand: [], board: [], gameOver: null, isSpectator: false, turnHolder: '', p1Name: '', p2Name: '' });
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
