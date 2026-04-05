import { create } from 'zustand';
import { BattleshipSocketManager } from '../data/network/BattleshipSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { BattleshipCell, BattleshipState, GameOverPayload, ShipPlacement } from '../data/models/ApiModels';

const EMPTY_BOARD = (): BattleshipCell[][] =>
  Array.from({ length: 10 }, () => Array(10).fill('empty') as BattleshipCell[]);

export interface PlacedShip extends ShipPlacement {
  size: number;
}

export const SHIP_CATALOG: { type: string; size: number }[] = [
  { type: 'Carrier', size: 5 },
  { type: 'Battleship', size: 4 },
  { type: 'Cruiser', size: 3 },
  { type: 'Submarine', size: 3 },
  { type: 'Destroyer', size: 2 },
];

// Android phases: PLACEMENT → WAITING (submitted, waiting for opponent) → BATTLE → GAME_OVER
interface BattleshipStoreState {
  phase: 'placement' | 'waiting' | 'battle' | 'finished';
  playerBoard: BattleshipCell[][];
  opponentBoard: BattleshipCell[][];
  placedShips: PlacedShip[];
  selectedShipType: string | null;
  selectedHorizontal: boolean;
  currentPlayer: string;
  myUsername: string;
  isMyTurn: boolean;
  animatingShot: { row: number; col: number } | null;
  lastShot: { row: number; col: number; result: 'hit' | 'miss' | 'sunk' } | null;
  gameOver: GameOverPayload | null;
  error: string | null;
  socket: BattleshipSocketManager | null;
}

interface BattleshipStoreActions {
  initGame: (roomId: string, myUsername: string) => void;
  cleanup: () => void;
  selectShipType: (type: string) => void;
  toggleOrientation: () => void;
  placeShipAt: (row: number, col: number) => void;
  removeShip: (type: string) => void;
  submitPlacement: (roomId: string) => Promise<void>;
  fire: (roomId: string, row: number, col: number) => void;
  clearError: () => void;
}

type BattleshipStore = BattleshipStoreState & BattleshipStoreActions;

export const useBattleshipStore = create<BattleshipStore>((set, get) => ({
  phase: 'placement',
  playerBoard: EMPTY_BOARD(),
  opponentBoard: EMPTY_BOARD(),
  placedShips: [],
  selectedShipType: 'Carrier',
  selectedHorizontal: true,
  currentPlayer: '',
  myUsername: '',
  isMyTurn: false,
  animatingShot: null,
  lastShot: null,
  gameOver: null,
  error: null,
  socket: null,

  initGame(roomId, myUsername) {
    const socket = new BattleshipSocketManager();
    socket.connect(roomId);
    socket.onGameUpdate((state: BattleshipState) => {
      const isMyTurn = state.currentPlayer === myUsername;
      // Normalize phase: backend may send uppercase (PLACEMENT, BATTLE, GAME_OVER) or use roomStatus/status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = state as any;
      const rawPhaseStr: string = (
        raw.phase ?? raw.roomPhase ?? raw.room_phase ?? raw.status ?? raw.roomStatus ?? ''
      ).toString().toLowerCase();
      const phase = (rawPhaseStr === 'game_over' ? 'finished' : rawPhaseStr || 'placement') as BattleshipStoreState['phase'];
      set({
        phase,
        ...(state.myBoard && { playerBoard: state.myBoard }),
        ...(state.opponentBoard && { opponentBoard: state.opponentBoard }),
        currentPlayer: state.currentPlayer ?? '',
        isMyTurn,
        lastShot: state.lastShot ?? null,
        gameOver: state.gameOver ?? null,
      });
      if (state.lastShot) {
        set({ animatingShot: { row: state.lastShot.row, col: state.lastShot.col } });
        setTimeout(() => set({ animatingShot: null }), 2000);
      }
    });
    set({ socket, myUsername });
  },

  cleanup() {
    get().socket?.disconnect();
    set({
      socket: null,
      phase: 'placement',
      playerBoard: EMPTY_BOARD(),
      opponentBoard: EMPTY_BOARD(),
      placedShips: [],
      gameOver: null,
      error: null,
    });
  },

  selectShipType(type) {
    set({ selectedShipType: type });
  },

  toggleOrientation() {
    set((s) => ({ selectedHorizontal: !s.selectedHorizontal }));
  },

  placeShipAt(row, col) {
    const { selectedShipType, selectedHorizontal, placedShips, playerBoard } = get();
    if (!selectedShipType) return;
    const catalog = SHIP_CATALOG.find((s) => s.type === selectedShipType);
    if (!catalog) return;

    // remove existing placement of same type
    const filtered = placedShips.filter((s) => s.type !== selectedShipType);

    // validate bounds
    if (selectedHorizontal && col + catalog.size > 10) return;
    if (!selectedHorizontal && row + catalog.size > 10) return;

    // check overlap
    const newBoard = playerBoard.map((r) => [...r]) as BattleshipCell[][];
    // clear old ship cells
    filtered.forEach((s) => {
      for (let i = 0; i < s.size; i++) {
        const r = s.horizontal ? s.row : s.row + i;
        const c = s.horizontal ? s.col + i : s.col;
        newBoard[r][c] = 'empty';
      }
    });
    for (let i = 0; i < catalog.size; i++) {
      const r = selectedHorizontal ? row : row + i;
      const c = selectedHorizontal ? col + i : col;
      if (newBoard[r][c] !== 'empty') return; // overlap
      newBoard[r][c] = 'ship';
    }

    const newShip: PlacedShip = { type: selectedShipType, size: catalog.size, row, col, horizontal: selectedHorizontal };
    set({ placedShips: [...filtered, newShip], playerBoard: newBoard });
  },

  removeShip(type) {
    const { placedShips, playerBoard } = get();
    const ship = placedShips.find((s) => s.type === type);
    if (!ship) return;
    const newBoard = playerBoard.map((r) => [...r]) as BattleshipCell[][];
    for (let i = 0; i < ship.size; i++) {
      const r = ship.horizontal ? ship.row : ship.row + i;
      const c = ship.horizontal ? ship.col + i : ship.col;
      newBoard[r][c] = 'empty';
    }
    set({ placedShips: placedShips.filter((s) => s.type !== type), playerBoard: newBoard });
  },

  async submitPlacement(roomId) {
    const { placedShips } = get();
    if (placedShips.length < SHIP_CATALOG.length) {
      set({ error: 'Place all ships before starting' });
      return;
    }
    try {
      // Android: only calls submitBattleshipPlacement — server handles readiness automatically
      // The placement response roomStatus tells whether both players are ready (battle starts)
      await apiRepository.submitBattleshipPlacement(roomId, { ships: placedShips });
      // Transition to WAITING — socket will push to BATTLE when opponent submits too
      set({ phase: 'waiting' });
    } catch (e: unknown) {
      set({ error: String(e) });
    }
  },

  fire(roomId, row, col) {
    const { isMyTurn, phase, socket, opponentBoard } = get();
    if (!isMyTurn || (phase !== 'battle') || !socket) return;
    if (opponentBoard[row][col] !== 'empty') return; // already fired
    socket.fire(roomId, row, col);
    set({ animatingShot: { row, col } });
  },

  clearError() {
    set({ error: null });
  },
}));
