import { create } from 'zustand';
import { BattleshipSocketManager } from '../data/network/BattleshipSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { BattleshipCell, GameOverPayload, ShipPlacement } from '../data/models/ApiModels';

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMPTY_BOARD = (): BattleshipCell[][] =>
  Array.from({ length: 10 }, () => Array(10).fill('empty') as BattleshipCell[]);

const GAME_OVER_OUTCOMES = new Set([
  'win', 'lose', 'forfeit', 'opponent_disconnected', 'timeout_loss', 'draw', 'match_cancelled',
]);

export interface PlacedShip extends ShipPlacement { size: number }

export const SHIP_CATALOG: { type: string; size: number }[] = [
  { type: 'Carrier',    size: 5 },
  { type: 'Battleship', size: 4 },
  { type: 'Cruiser',    size: 3 },
  { type: 'Submarine',  size: 3 },
  { type: 'Destroyer',  size: 2 },
];

// ── State / Actions ───────────────────────────────────────────────────────────
interface BattleshipStoreState {
  phase: 'placement' | 'waiting' | 'battle' | 'finished';
  playerBoard: BattleshipCell[][];
  opponentBoard: BattleshipCell[][];
  placedShips: PlacedShip[];
  selectedShipType: string | null;
  selectedHorizontal: boolean;
  myUsername: string;
  isMyTurn: boolean;
  /** Set when I fire, cleared when outcome arrives — used to assign shot to correct board */
  hasPendingFire: boolean;
  animatingShot: { row: number; col: number } | null;
  lastShot: { row: number; col: number; result: 'hit' | 'miss' | 'sunk' } | null;
  /** Short message shown as toast after a shot ("Direct hit!", "Miss!", etc.) */
  shotMessage: string | null;
  gameOver: GameOverPayload | null;
  /** True once the opponent has joined the room */
  opponentConfirmed: boolean;
  /** Toast text shown when opponent joins */
  opponentJoinedToast: string | null;
  /** Opponent's username (received via socket or from URL param) */
  opponentName: string;
  /** Show "opponent left" dialog — true when opponent abandons before game starts */
  opponentLeftDialog: boolean;
  error: string | null;
  placementError: string | null;
  /** Race-condition buffer: game-start signal arrived before placement REST returned */
  pendingBattleStart: { isMyTurn: boolean } | null;
  socket: BattleshipSocketManager | null;
}

interface BattleshipStoreActions {
  initGame: (roomId: string, myUsername: string, hasOpponent?: boolean, initialOpponentName?: string) => void;
  cleanup: () => void;
  selectShipType: (type: string) => void;
  toggleOrientation: () => void;
  placeShipAt: (row: number, col: number) => void;
  removeShip: (type: string) => void;
  submitPlacement: (roomId: string) => Promise<void>;
  fire: (roomId: string, row: number, col: number) => void;
  clearError: () => void;
  clearPlacementError: () => void;
  clearShotMessage: () => void;
  clearOpponentJoinedToast: () => void;
  clearOpponentLeftDialog: () => void;
}

type BattleshipStore = BattleshipStoreState & BattleshipStoreActions;

// ── Store ─────────────────────────────────────────────────────────────────────
export const useBattleshipStore = create<BattleshipStore>((set, get) => ({
  phase: 'placement',
  playerBoard: EMPTY_BOARD(),
  opponentBoard: EMPTY_BOARD(),
  placedShips: [],
  selectedShipType: 'Carrier',
  selectedHorizontal: true,
  myUsername: '',
  isMyTurn: false,
  hasPendingFire: false,
  animatingShot: null,
  lastShot: null,
  shotMessage: null,
  gameOver: null,
  opponentConfirmed: false,
  opponentJoinedToast: null,
  opponentName: '',
  opponentLeftDialog: false,
  error: null,
  placementError: null,
  pendingBattleStart: null,
  socket: null,

  // ── initGame ────────────────────────────────────────────────────────────────
  initGame(roomId, myUsername, hasOpponent = false, initialOpponentName = '') {
    const socket = new BattleshipSocketManager();
    socket.connect(roomId);
    // Pre-seed opponent state when joining an existing room
    if (hasOpponent) {
      set({ opponentConfirmed: true, opponentName: initialOpponentName });
    }

    socket.onGameUpdate((raw: unknown) => {
      // Normalize: payload can be { success, data: {...} } or flat
      const envelope = (raw ?? {}) as Record<string, unknown>;
      const success  = envelope.success !== false;
      const data     = (
        envelope.data && typeof envelope.data === 'object'
          ? envelope.data
          : envelope
      ) as Record<string, unknown>;

      // ── Full state sync (reconnection) ──────────────────────────────────────
      const ships = data.ships;
      if (data.gameStarted && Array.isArray(ships) && (ships as unknown[]).length > 0) {
        handleFullSync(data, get().myUsername, set);
        return;
      }

      // ── API / socket error ──────────────────────────────────────────────────
      if (!success) {
        const msgs = (data.messages ?? data.errorMessages ?? data.userMessages) as string[] | undefined;
        set({ error: msgs?.[0] ?? 'Game error — please reconnect' });
        return;
      }

      // ── Opponent left pre-game (check BEFORE waitingForOpponent — payload has both) ──
      // Android payload: { "opponentLeft": true, "waitingForOpponent": true }
      if (data.opponentLeft === true) {
        const { phase } = get();
        if (phase === 'placement' || phase === 'waiting') {
          // Reset back to placement so player can wait for a new opponent
          set({
            phase: 'placement',
            opponentConfirmed: false,
            opponentName: '',
            opponentLeftDialog: true,
            pendingBattleStart: null,
          });
        }
        return;
      }

      // ── Opponent joined ─────────────────────────────────────────────────────
      if (data.opponentJoined === true) {
        const name = ((data.userName ?? data.opponentName ?? 'Opponent') as string).trim();
        set({ opponentConfirmed: true, opponentName: name, opponentJoinedToast: `${name} joined!` });
        return;
      }

      // ── Waiting for a second player to join ─────────────────────────────────
      if (data.waitingForOpponent === true) {
        // Stay in placement — UI will show "Waiting for opponent to join"
        return;
      }

      // ── Shot outcome ─────────────────────────────────────────────────────────
      const outcome  = typeof data.outcome === 'string' ? data.outcome : undefined;
      const row      = typeof data.row      === 'number' ? data.row      : -1;
      const col      = typeof data.col      === 'number' ? data.col      : -1;
      const shipType = typeof data.shipType === 'string' ? data.shipType : undefined;
      const yourTurn = typeof data.yourTurn === 'boolean' ? data.yourTurn : undefined;

      if (outcome) {
        // ── Game-over outcomes ────────────────────────────────────────────────
        if (GAME_OVER_OUTCOMES.has(outcome)) {
          const isDraw  = outcome === 'draw';
          const youWon  = outcome === 'win' ||
            ((outcome === 'forfeit' || outcome === 'opponent_disconnected') &&
              (data.youWon as boolean ?? false));
          const prize   = typeof data.prize === 'number' ? data.prize : undefined;

          const pBoard = get().playerBoard.map(r => [...r]) as BattleshipCell[][];
          const oBoard = get().opponentBoard.map(r => [...r]) as BattleshipCell[][];

          if (row >= 0 && col >= 0) {
            if (get().hasPendingFire) {
              oBoard[row][col] = 'sunk'; // my final winning shot
            } else {
              pBoard[row][col] = 'hit';  // opponent's final shot on me
            }
          }

          set({
            phase: 'finished',
            playerBoard: pBoard,
            opponentBoard: oBoard,
            hasPendingFire: false,
            isMyTurn: false,
            animatingShot: row >= 0 ? { row, col } : null,
            gameOver: {
              outcome: isDraw ? 'draw' : youWon ? 'win' : 'lose',
              youWon,
              isDraw,
              prize: youWon ? prize : undefined,
            },
          });
          if (row >= 0) setTimeout(() => set({ animatingShot: null }), 2000);
          return;
        }

        // ── Regular shot outcome (hit / miss / sunk) ──────────────────────────
        const isHit   = outcome === 'hit' || outcome === 'sunk';
        const pBoard  = get().playerBoard.map(r => [...r]) as BattleshipCell[][];
        const oBoard  = get().opponentBoard.map(r => [...r]) as BattleshipCell[][];
        let   shotMsg: string | null = null;

        if (row >= 0 && col >= 0) {
          if (get().hasPendingFire) {
            // My shot resolved → update opponent board
            oBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
            shotMsg = outcome === 'sunk' && shipType
              ? `You sunk the ${capitalize(shipType)}!`
              : outcome === 'sunk' ? 'Enemy ship sunk!'
              : isHit ? 'Direct hit!'
              : 'Miss!';
          } else {
            // Opponent's shot → update my board
            pBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
            shotMsg = outcome === 'sunk' && shipType
              ? `Your ${capitalize(shipType)} was sunk!`
              : isHit ? 'Your ship was hit!'
              : 'Opponent missed!';
          }
        }

        set({
          playerBoard: pBoard,
          opponentBoard: oBoard,
          hasPendingFire: false,
          isMyTurn: yourTurn ?? false,
          shotMessage: shotMsg,
          animatingShot: row >= 0 ? { row, col } : null,
          lastShot: row >= 0
            ? { row, col, result: outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss' }
            : get().lastShot,
        });
        if (row >= 0) setTimeout(() => set({ animatingShot: null }), 2000);
        return;
      }

      // ── yourTurn without outcome = game-start signal ───────────────────────
      if (yourTurn !== undefined) {
        const { phase } = get();

        if (phase === 'waiting') {
          // Normal path: both players submitted placement, server says go
          set({ phase: 'battle', isMyTurn: yourTurn, hasPendingFire: false });
        } else if (phase === 'placement') {
          // Race condition: game-start arrived before placement REST returned
          set({ pendingBattleStart: { isMyTurn: yourTurn } });
        } else if (phase === 'battle') {
          // Spurious yourTurn during battle (shouldn't happen, but handle gracefully)
          set({ isMyTurn: yourTurn });
        }
      }
    });

    set({ socket, myUsername });
  },

  // ── cleanup ─────────────────────────────────────────────────────────────────
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
      placementError: null,
      hasPendingFire: false,
      opponentConfirmed: false,
      opponentJoinedToast: null,
      opponentName: '',
      opponentLeftDialog: false,
      shotMessage: null,
      animatingShot: null,
      pendingBattleStart: null,
      isMyTurn: false,
    });
  },

  // ── ship placement ───────────────────────────────────────────────────────────
  selectShipType(type) { set({ selectedShipType: type }); },

  toggleOrientation() { set(s => ({ selectedHorizontal: !s.selectedHorizontal })); },

  placeShipAt(row, col) {
    const { selectedShipType, selectedHorizontal, placedShips, playerBoard } = get();
    if (!selectedShipType) return;
    const catalog = SHIP_CATALOG.find(s => s.type === selectedShipType);
    if (!catalog) return;

    const filtered = placedShips.filter(s => s.type !== selectedShipType);

    if (selectedHorizontal && col + catalog.size > 10) {
      set({ placementError: `${selectedShipType} doesn't fit here — try further left` });
      return;
    }
    if (!selectedHorizontal && row + catalog.size > 10) {
      set({ placementError: `${selectedShipType} doesn't fit here — try higher up` });
      return;
    }

    // Build board with only OTHER ships, then check overlap
    const newBoard = playerBoard.map(r => [...r]) as BattleshipCell[][];
    placedShips.forEach(s => {
      for (let i = 0; i < s.size; i++) {
        const r = s.horizontal ? s.row : s.row + i;
        const c = s.horizontal ? s.col + i : s.col;
        newBoard[r][c] = 'empty';
      }
    });
    filtered.forEach(s => {
      for (let i = 0; i < s.size; i++) {
        const r = s.horizontal ? s.row : s.row + i;
        const c = s.horizontal ? s.col + i : s.col;
        newBoard[r][c] = 'ship';
      }
    });

    for (let i = 0; i < catalog.size; i++) {
      const r = selectedHorizontal ? row : row + i;
      const c = selectedHorizontal ? col + i : col;
      if (newBoard[r][c] !== 'empty') {
        set({ placementError: 'That space is already occupied' });
        return;
      }
      newBoard[r][c] = 'ship';
    }

    set({
      placedShips: [...filtered, { type: selectedShipType, size: catalog.size, row, col, horizontal: selectedHorizontal }],
      playerBoard: newBoard,
    });
  },

  removeShip(type) {
    const { placedShips, playerBoard } = get();
    const ship = placedShips.find(s => s.type === type);
    if (!ship) return;
    const newBoard = playerBoard.map(r => [...r]) as BattleshipCell[][];
    for (let i = 0; i < ship.size; i++) {
      const r = ship.horizontal ? ship.row : ship.row + i;
      const c = ship.horizontal ? ship.col + i : ship.col;
      newBoard[r][c] = 'empty';
    }
    set({ placedShips: placedShips.filter(s => s.type !== type), playerBoard: newBoard });
  },

  async submitPlacement(roomId) {
    const { placedShips } = get();
    if (placedShips.length < SHIP_CATALOG.length) {
      set({ error: 'Place all ships before starting' });
      return;
    }
    try {
      await apiRepository.submitBattleshipPlacement(roomId, { ships: placedShips });
      // Transition to WAITING — unless game-start signal already buffered (race condition)
      const { pendingBattleStart } = get();
      if (pendingBattleStart) {
        set({ phase: 'battle', isMyTurn: pendingBattleStart.isMyTurn, pendingBattleStart: null });
      } else {
        set({ phase: 'waiting' });
      }
    } catch (e: unknown) {
      set({ error: String(e) });
    }
  },

  fire(roomId, row, col) {
    const { isMyTurn, phase, socket, opponentBoard, hasPendingFire } = get();
    if (!isMyTurn || phase !== 'battle' || !socket || hasPendingFire) return;
    if (opponentBoard[row][col] !== 'empty') return;
    socket.fire(roomId, row, col);
    set({ hasPendingFire: true, isMyTurn: false, animatingShot: { row, col } });
  },

  clearError()              { set({ error: null }); },
  clearPlacementError()     { set({ placementError: null }); },
  clearShotMessage()        { set({ shotMessage: null }); },
  clearOpponentJoinedToast(){ set({ opponentJoinedToast: null }); },
  clearOpponentLeftDialog() { set({ opponentLeftDialog: false }); },
}));

// ── Full state sync (reconnection) ────────────────────────────────────────────
function handleFullSync(
  data: Record<string, unknown>,
  myUsername: string,
  set: (s: Partial<BattleshipStoreState>) => void,
) {
  const playerBoard   = EMPTY_BOARD();
  const opponentBoard = EMPTY_BOARD();

  // Re-mark my own ships from the ships array
  const ships = (data.ships as Record<string, unknown>[]) ?? [];
  ships.forEach(ship => {
    const cells = ship.cells as number[][] | undefined;
    cells?.forEach(([r, c]) => {
      if (r >= 0 && r < 10 && c >= 0 && c < 10) playerBoard[r][c] = 'ship';
    });
  });

  // Replay shot history
  const history = (data.history as Record<string, unknown>[]) ?? [];
  history.forEach(shot => {
    const { player, row, col, outcome } = shot as Record<string, unknown>;
    const r = row as number;
    const c = col as number;
    const o = outcome as string;
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return;
    const isHit = o === 'hit' || o === 'sunk';
    const cell: BattleshipCell = o === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
    if (player === myUsername) {
      opponentBoard[r][c] = cell; // I shot at them
    } else {
      playerBoard[r][c] = cell;   // They shot at me
    }
  });

  const p1 = data.player1 as string ?? '';
  const p2 = data.player2 as string ?? '';
  const opponentName = p1 === myUsername ? p2 : p1;

  set({
    phase: 'battle',
    playerBoard,
    opponentBoard,
    isMyTurn: data.yourTurn as boolean ?? false,
    opponentConfirmed: true,
    opponentName,
    hasPendingFire: false,
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
