import { create } from 'zustand';
import { BattleshipSocketManager } from '../data/network/BattleshipSocketManager';
import { apiRepository } from '../data/network/ApiRepository';
import type { BattleshipCell, GameOverPayload, ShipPlacement } from '../data/models/ApiModels';

import { SpectatorPayload } from '../util/SpectatorPayload';
import { tournamentDebugLog } from '../debug/tournamentDebugLog';

const EMPTY_BOARD = (): BattleshipCell[][] =>
  Array.from({ length: 10 }, () => Array(10).fill('empty') as BattleshipCell[]);

/** Shift anchor minimally so every cell of the ship stays on the 10×10 grid. */
function clampBattleshipAnchor(
  row: number,
  col: number,
  size: number,
  horizontal: boolean,
): { row: number; col: number } {
  const r0 = Number.isFinite(row) ? row : 0;
  const c0 = Number.isFinite(col) ? col : 0;
  if (horizontal) {
    return {
      row: Math.max(0, Math.min(9, Math.round(r0))),
      col: Math.max(0, Math.min(10 - size, Math.round(c0))),
    };
  }
  return {
    row: Math.max(0, Math.min(10 - size, Math.round(r0))),
    col: Math.max(0, Math.min(9, Math.round(c0))),
  };
}

const GAME_OVER_OUTCOMES = new Set([
  'win', 'lose', 'forfeit', 'opponent_disconnected', 'timeout_loss', 'draw', 'match_cancelled',
]);

export interface PlacedShip extends ShipPlacement { size: number }

/**
 * When a ship is sunk, find all adjacent hit/sunk cells from the sunk cell
 * to reconstruct the full ship, then mark them all 'sunk'.
 */
function deriveSunkShip(
  board: BattleshipCell[][],
  sunkRow: number, sunkCol: number,
  shipType: string | undefined,
): PlacedShip | null {
  const catalog = shipType
    ? SHIP_CATALOG.find(s => s.type.toLowerCase() === shipType.toLowerCase())
    : undefined;
  const expectedSize = catalog?.size ?? 0;
  const resolvedType = catalog?.type ?? shipType ?? 'Unknown';

  const isPartOfShip = (r: number, c: number) =>
    r >= 0 && r < 10 && c >= 0 && c < 10 &&
    (board[r][c] === 'hit' || board[r][c] === 'sunk');

  // Expand horizontally
  let hCells: [number, number][] = [[sunkRow, sunkCol]];
  for (let c = sunkCol - 1; isPartOfShip(sunkRow, c); c--) hCells.unshift([sunkRow, c]);
  for (let c = sunkCol + 1; isPartOfShip(sunkRow, c); c++) hCells.push([sunkRow, c]);

  // Expand vertically
  let vCells: [number, number][] = [[sunkRow, sunkCol]];
  for (let r = sunkRow - 1; isPartOfShip(r, sunkCol); r--) vCells.unshift([r, sunkCol]);
  for (let r = sunkRow + 1; isPartOfShip(r, sunkCol); r++) vCells.push([r, sunkCol]);

  // Pick the line that matches expected size, or the longer one
  let shipCells: [number, number][];
  if (expectedSize > 0) {
    shipCells = hCells.length === expectedSize ? hCells : vCells.length === expectedSize ? vCells : (hCells.length >= vCells.length ? hCells : vCells);
  } else {
    shipCells = hCells.length >= vCells.length ? hCells : vCells;
  }

  if (shipCells.length < 2) {
    // Fallback: could be a 1-cell scenario — still valid for submarines etc
    if (expectedSize === 1 || shipCells.length === 1) {
      // mark and return
    } else {
      return null;
    }
  }

  // Mark all cells as 'sunk'
  for (const [r, c] of shipCells) board[r][c] = 'sunk';

  const startRow = shipCells[0][0];
  const startCol = shipCells[0][1];
  const horizontal = shipCells.length > 1 ? shipCells[0][0] === shipCells[1][0] : true;

  return {
    type: resolvedType,
    row: startRow,
    col: startCol,
    horizontal,
    size: shipCells.length,
  };
}

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
  animatingShot: { row: number; col: number; board: 'player' | 'opponent' } | null;
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
  /** True when joined as spectator */
  isSpectator: boolean;
  /** Username that owns playerBoard (spectator mode — used for shot attribution) */
  spectatorBoardOwner: string;
  /** Display name of the player who owns playerBoard (bottom board in spectator view) */
  spectatorFleetOwnerName: string;
  /** Display name of the player who owns opponentBoard (top board in spectator view) */
  spectatorOpponentFleetName: string;
  /** Username shown as "whose turn it is" for spectators */
  spectatorCurrentPlayer: string;
  /** Live count of spectators watching (broadcast by server on every event) */
  spectatorsCount: number;
  /** Turn timer duration in seconds (from server payload `turnTimerSeconds`) */
  turnTimerSeconds: number;
  /** Increments on each shot — used as TurnTimer resetKey for spectators */
  shotCount: number;
  /** Enemy ships revealed when sunk — used to render sprite overlays on opponent board */
  sunkEnemyShips: PlacedShip[];
}

interface BattleshipStoreActions {
  initGame: (roomId: string, myUsername: string, hasOpponent?: boolean, initialOpponentName?: string, isSpectator?: boolean) => void;
  cleanup: () => void;
  selectShipType: (type: string) => void;
  toggleOrientation: () => void;
  placeShipAt: (row: number, col: number) => void;
  /** Reposition an already placed ship (same orientation). */
  moveShipTo: (type: string, row: number, col: number) => void;
  /** Toggle horizontal/vertical for a ship already on the board. */
  togglePlacedShipOrientation: (type: string) => void;
  removeShip: (type: string) => void;
  submitPlacement: (roomId: string) => Promise<void>;
  fire: (roomId: string, row: number, col: number) => void;
  clearError: () => void;
  clearPlacementError: () => void;
  clearShotMessage: () => void;
  clearOpponentJoinedToast: () => void;
  clearOpponentLeftDialog: () => void;
  resetFleet: () => void;
}

type BattleshipStore = BattleshipStoreState & BattleshipStoreActions;

/** GET /rooms/:id/status every 10s while alone in placement — catches opponent join if socket lags. */
const BS_OPPONENT_STATUS_POLL_MS = 10_000;

let battleshipOpponentPollInterval: ReturnType<typeof setInterval> | null = null;

function clearBattleshipOpponentPoll() {
  if (battleshipOpponentPollInterval) {
    clearInterval(battleshipOpponentPollInterval);
    battleshipOpponentPollInterval = null;
  }
}

function startBattleshipOpponentPoll(roomId: string, get: () => BattleshipStore) {
  clearBattleshipOpponentPoll();
  battleshipOpponentPollInterval = window.setInterval(async () => {
    const s = get();
    if (s.isSpectator || s.opponentConfirmed || s.phase !== 'placement') {
      clearBattleshipOpponentPoll();
      return;
    }
    try {
      const status = await apiRepository.getRoomStatus(roomId);
      const st = (status.status || '').toLowerCase();
      if (status.playerCount >= 2 || st === 'started') {
        s.socket?.requestSync(roomId);
      }
    } catch {
      /* ignore transient network errors */
    }
  }, BS_OPPONENT_STATUS_POLL_MS);
}

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
  isSpectator: false,
  spectatorBoardOwner: '',
  spectatorFleetOwnerName: '',
  spectatorOpponentFleetName: '',
  spectatorCurrentPlayer: '',
  spectatorsCount: 0,
  turnTimerSeconds: 30,
  shotCount: 0,
  sunkEnemyShips: [],

  // ── initGame ────────────────────────────────────────────────────────────────
  initGame(roomId, myUsername, hasOpponent = false, initialOpponentName = '', isSpectator = false) {
    // #region agent log
    tournamentDebugLog(
      'battleshipStore.ts:initGame',
      'battleship socket connect',
      { roomId, hasOpponent, isSpectator, myUsernameLen: myUsername.length },
      'H4',
    );
    // #endregion
    console.log('[SPECTATOR][7] battleshipStore.initGame → roomId:', roomId, '| myUsername:', myUsername, '| isSpectator:', isSpectator, '| hasOpponent:', hasOpponent, '| initialOpponentName:', initialOpponentName);
    clearBattleshipOpponentPoll();

    const socket = new BattleshipSocketManager();
    socket.connect(roomId);

    if (isSpectator) {
      set({ isSpectator: true, phase: 'battle', opponentConfirmed: true, opponentName: initialOpponentName });
      setTimeout(() => {
        if (get().opponentBoard.every(row => row.every(c => c === 'empty'))) {
          socket.requestSync(roomId);
        }
      }, 1500);
    } else if (hasOpponent) {
      set({ opponentConfirmed: true, opponentName: initialOpponentName });
    } else {
      startBattleshipOpponentPoll(roomId, get);
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

      // ── Spectator count (broadcast on every event — mirrors Android applySpectatorBroadcast) ──
      const sc = typeof data.spectatorsCount === 'number' ? data.spectatorsCount
               : typeof data.spectators_count === 'number' ? data.spectators_count
               : -1;
      if (sc >= 0) set({ spectatorsCount: sc });

      // ── Spectator refresh: extract player names + turn holder from every event ──
      // Mirrors Android BattleshipViewModel.refreshSpectatorBattleshipUi()
      const spectatorMode = get().isSpectator;
      if (spectatorMode) {
        const { p1: ep1, p2: ep2, turnHolder } = SpectatorPayload.extractStandardTurnAndNames(data);
        console.log('[SPECTATOR][8] Per-event name refresh → p1:', ep1, '| p2:', ep2, '| turnHolder:', turnHolder, '| raw event keys:', Object.keys(data));
        const prev = get();
        const nameUpdates: Partial<BattleshipStoreState> = {};
        if (ep1) nameUpdates.spectatorFleetOwnerName = ep1;
        if (ep2) nameUpdates.spectatorOpponentFleetName = ep2;
        // Board owner (for shot attribution) is set once in handleFullSync; keep in sync with name
        if (ep1 && !prev.spectatorBoardOwner) nameUpdates.spectatorBoardOwner = ep1;
        if (turnHolder) nameUpdates.spectatorCurrentPlayer = turnHolder;
        if (Object.keys(nameUpdates).length > 0) set(nameUpdates);
      }

      // ── Full state sync (reconnection / spectator join) ─────────────────────
      // Android: spectators enter sync when isSpectatorJoin && history.length > 0;
      // participants enter when gameStarted && ships[].length > 0.
      const ships = data.ships;
      const gameStarted = !!(data.gameStarted || data.game_started);
      const hasHistory  = Array.isArray(data.history) && (data.history as unknown[]).length > 0;
      const hasShips    = Array.isArray(ships) && (ships as unknown[]).length > 0;
      if ((gameStarted && (spectatorMode || hasShips)) || (spectatorMode && hasHistory)) {
        console.log('[SPECTATOR][9] handleFullSync triggered → gameStarted:', gameStarted, '| hasHistory:', hasHistory, '| isSpectator:', spectatorMode, '| player1:', data.player1, '| player2:', data.player2);
        handleFullSync(data, get().myUsername, spectatorMode, set);
        return;
      }

      // ── API / socket error ──────────────────────────────────────────────────
      if (!success) {
        const msgs = (envelope.messages ?? data.messages ?? data.errorMessages ?? data.userMessages) as string[] | undefined;
        // #region agent log
        tournamentDebugLog(
          'battleshipStore.ts:onGameUpdate',
          'naval-battle join/error',
          {
            roomId,
            errorMessage: msgs?.[0] ?? null,
            envelopeKeys: Object.keys(envelope),
          },
          'H5',
        );
        // #endregion
        set({ error: msgs?.[0] ?? 'Game error — please reconnect' });
        return;
      }

      // ── Opponent left pre-game (check BEFORE waitingForOpponent — payload has both) ──
      // Android payload: { "opponentLeft": true, "waitingForOpponent": true }
      if (data.opponentLeft === true) {
        // Spectators are unaffected by opponent-left events
        if (get().isSpectator) return;
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
          startBattleshipOpponentPoll(roomId, get);
        }
        return;
      }

      // ── Opponent joined ─────────────────────────────────────────────────────
      if (data.opponentJoined === true) {
        const name = ((data.userName ?? data.opponentName ?? 'Opponent') as string).trim();
        clearBattleshipOpponentPoll();
        set({ opponentConfirmed: true, opponentName: name, opponentJoinedToast: 'ws.games.opponentJoined' });
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
      // Extract turn timer duration from payload (server field: turnTimerSeconds)
      if (typeof data.turnTimerSeconds === 'number' && data.turnTimerSeconds > 0) {
        set({ turnTimerSeconds: data.turnTimerSeconds });
      }

      // Spectator shot attribution: server sends who fired the shot.
      // Check shotFrom/shot_from first (Android primary key), then player/shooter as fallback.
      const shooter  = typeof data.shotFrom  === 'string' ? data.shotFrom  :
                       typeof data.shot_from === 'string' ? data.shot_from :
                       typeof data.player    === 'string' ? data.player    :
                       typeof data.shooter   === 'string' ? data.shooter   : undefined;
      if (spectatorMode) {
        console.log('[SPECTATOR][10] Shot event → outcome:', data.outcome, '| row:', data.row, '| col:', data.col, '| shooter resolved as:', shooter, '| spectatorBoardOwner:', get().spectatorBoardOwner);
      }

      if (outcome) {
        // ── Game-over outcomes ────────────────────────────────────────────────
        if (GAME_OVER_OUTCOMES.has(outcome)) {
          const { isSpectator: spec, myUsername, spectatorBoardOwner: boardOwner, hasPendingFire } = get();
          const gameOver = SpectatorPayload.resolveStandardGameOver(data, myUsername, spec, 'BATTLESHIP');
          
          const pBoard = get().playerBoard.map(r => [...r]) as BattleshipCell[][];
          const oBoard = get().opponentBoard.map(r => [...r]) as BattleshipCell[][];

          let finalBoard: 'player' | 'opponent' = 'player';
          let finalSunkShips = get().sunkEnemyShips;
          if (row >= 0 && col >= 0) {
            const finalShotFromPlayer1 = spec
              ? (shooter != null ? shooter === boardOwner : false)
              : hasPendingFire;
            finalBoard = finalShotFromPlayer1 ? 'opponent' : 'player';
            if (finalShotFromPlayer1) {
              oBoard[row][col] = 'sunk';
              if (outcome === 'sunk' || outcome === 'win') {
                const derived = deriveSunkShip(oBoard, row, col, shipType);
                if (derived) finalSunkShips = [...finalSunkShips, derived];
              }
            } else {
              pBoard[row][col] = 'hit';
            }
          }

          const isSunkShot = outcome === 'win' || outcome === 'lose' || outcome === 'sunk';
          set({
            phase: 'finished',
            playerBoard: pBoard,
            opponentBoard: oBoard,
            sunkEnemyShips: finalSunkShips,
            hasPendingFire: false,
            isMyTurn: false,
            animatingShot: row >= 0 ? { row, col, board: finalBoard } : null,
            lastShot: row >= 0 ? { row, col, result: isSunkShot ? 'sunk' : 'hit' } : get().lastShot,
            shotCount: row >= 0 ? get().shotCount + 1 : get().shotCount,
            gameOver,
          });
          if (row >= 0) {
            const animDur = isSunkShot ? 4000 : 2000;
            setTimeout(() => set({ animatingShot: null }), animDur);
          }
          return;
        }

        // ── Regular shot outcome (hit / miss / sunk) ──────────────────────────
        const isHit   = outcome === 'hit' || outcome === 'sunk';
        const pBoard  = get().playerBoard.map(r => [...r]) as BattleshipCell[][];
        const oBoard  = get().opponentBoard.map(r => [...r]) as BattleshipCell[][];
        let   shotMsg: string | null = null;
        const { isSpectator, spectatorBoardOwner, hasPendingFire, sunkEnemyShips } = get();
        let   newSunkShips = sunkEnemyShips;

        let shotBoard: 'player' | 'opponent' = 'player';
        if (row >= 0 && col >= 0) {
          const isShotFromPlayer1 = isSpectator
            ? (shooter != null ? shooter === spectatorBoardOwner : false)
            : hasPendingFire;
          shotBoard = isShotFromPlayer1 ? 'opponent' : 'player';

          if (isShotFromPlayer1) {
            oBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
            if (outcome === 'sunk') {
              const derived = deriveSunkShip(oBoard, row, col, shipType);
              if (derived) newSunkShips = [...sunkEnemyShips, derived];
            }
            if (!isSpectator) {
              shotMsg = outcome === 'sunk' && shipType
                ? `bs_outcome_you_sunk_${shipType.toLowerCase()}`
                : outcome === 'sunk' ? 'ws.games.shotSunk'
                : isHit ? 'ws.games.shotHit'
                : 'ws.games.shotMiss';
            }
          } else {
            pBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
            if (outcome === 'sunk') {
              deriveSunkShip(pBoard, row, col, shipType);
            }
            if (!isSpectator) {
              shotMsg = outcome === 'sunk' && shipType
                ? `bs_outcome_opponent_sunk_${shipType.toLowerCase()}`
                : isHit ? 'ws.games.opponentHit'
                : 'ws.games.opponentMiss';
            }
          }
        }

        set({
          playerBoard: pBoard,
          opponentBoard: oBoard,
          sunkEnemyShips: newSunkShips,
          hasPendingFire: false,
          isMyTurn: isSpectator ? false : (yourTurn ?? false),
          shotMessage: shotMsg,
          animatingShot: row >= 0 ? { row, col, board: shotBoard } : null,
          lastShot: row >= 0
            ? { row, col, result: outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss' }
            : get().lastShot,
          shotCount: get().shotCount + 1,
        });
        if (row >= 0) {
          const animDur = outcome === 'sunk' ? 4000 : 2000;
          setTimeout(() => set({ animatingShot: null }), animDur);
        }
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
    clearBattleshipOpponentPoll();
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
      isSpectator: false,
      spectatorBoardOwner: '',
      spectatorFleetOwnerName: '',
      spectatorOpponentFleetName: '',
      spectatorCurrentPlayer: '',
      spectatorsCount: 0,
      turnTimerSeconds: 30,
      shotCount: 0,
      sunkEnemyShips: [],
      selectedShipType: 'Carrier',
      selectedHorizontal: true,
    });
  },

  // ── ship placement ───────────────────────────────────────────────────────────
  selectShipType(type) { set({ selectedShipType: type }); },

  toggleOrientation() { set(s => ({ selectedHorizontal: !s.selectedHorizontal })); },

  moveShipTo(type: string, row: number, col: number) {
    const { placedShips, playerBoard } = get();
    const ship = placedShips.find((s) => s.type === type);
    if (!ship) return;
    const catalog = SHIP_CATALOG.find((s) => s.type === type);
    if (!catalog) return;
    const horiz = ship.horizontal;
    const { row: ar, col: ac } = clampBattleshipAnchor(row, col, catalog.size, horiz);
    if (ship.row === ar && ship.col === ac) return;

    const newBoard = playerBoard.map((r) => [...r]) as BattleshipCell[][];
    for (let i = 0; i < ship.size; i++) {
      const r = ship.horizontal ? ship.row : ship.row + i;
      const c = ship.horizontal ? ship.col + i : ship.col;
      newBoard[r][c] = 'empty';
    }

    for (let i = 0; i < catalog.size; i++) {
      const r = horiz ? ar : ar + i;
      const c = horiz ? ac + i : ac;
      if (newBoard[r][c] !== 'empty') {
        set({ placementError: 'bs_error_overlapping' });
        return;
      }
      newBoard[r][c] = 'ship';
    }

    const filtered = placedShips.filter((s) => s.type !== type);
    const newPlacedShips = [...filtered, { type, size: catalog.size, row: ar, col: ac, horizontal: horiz }];
    set({
      playerBoard: newBoard,
      placedShips: newPlacedShips,
      selectedShipType: type,
      placementError: null,
    });
  },

  togglePlacedShipOrientation(type: string) {
    const { placedShips, playerBoard } = get();
    const ship = placedShips.find((s) => s.type === type);
    if (!ship) return;
    const catalog = SHIP_CATALOG.find((s) => s.type === type);
    if (!catalog) return;
    const newHorizontal = !ship.horizontal;
    const { row, col } = clampBattleshipAnchor(ship.row, ship.col, catalog.size, newHorizontal);
    const filtered = placedShips.filter((s) => s.type !== type);

    const newBoard = playerBoard.map((r) => [...r]) as BattleshipCell[][];
    for (let i = 0; i < ship.size; i++) {
      const r = ship.horizontal ? ship.row : ship.row + i;
      const c = ship.horizontal ? ship.col + i : ship.col;
      newBoard[r][c] = 'empty';
    }

    for (let i = 0; i < catalog.size; i++) {
      const r = newHorizontal ? row : row + i;
      const c = newHorizontal ? col + i : col;
      if (newBoard[r][c] !== 'empty') {
        set({ placementError: 'bs_error_overlapping' });
        return;
      }
      newBoard[r][c] = 'ship';
    }

    const newPlacedShips = [
      ...filtered,
      { type, size: catalog.size, row, col, horizontal: newHorizontal },
    ];
    set({
      playerBoard: newBoard,
      placedShips: newPlacedShips,
      selectedShipType: type,
      placementError: null,
    });
  },

  placeShipAt(row, col) {
    const { selectedShipType, selectedHorizontal, placedShips, playerBoard } = get();
    if (!selectedShipType) return;
    const catalog = SHIP_CATALOG.find(s => s.type === selectedShipType);
    if (!catalog) return;

    const filtered = placedShips.filter(s => s.type !== selectedShipType);
    const { row: ar, col: ac } = clampBattleshipAnchor(row, col, catalog.size, selectedHorizontal);

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
      const r = selectedHorizontal ? ar : ar + i;
      const c = selectedHorizontal ? ac + i : ac;
      if (newBoard[r][c] !== 'empty') {
        set({ placementError: 'bs_error_overlapping' });
        return;
      }
      newBoard[r][c] = 'ship';
    }

    const newPlacedShips = [...filtered, { type: selectedShipType, size: catalog.size, row: ar, col: ac, horizontal: selectedHorizontal }];

    // Auto-select the next unplaced ship in catalog order
    const nextShip = SHIP_CATALOG.find(s => !newPlacedShips.some(p => p.type === s.type));

    set({
      placedShips: newPlacedShips,
      playerBoard: newBoard,
      selectedShipType: nextShip?.type ?? null,
      placementError: null,
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
      set({ error: 'bs_error_place_all_ships' });
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
    set({ hasPendingFire: true, isMyTurn: false, animatingShot: { row, col, board: 'opponent' } });
  },

  clearError()              { set({ error: null }); },
  clearPlacementError()     { set({ placementError: null }); },
  clearShotMessage()        { set({ shotMessage: null }); },
  clearOpponentJoinedToast(){ set({ opponentJoinedToast: null }); },
  clearOpponentLeftDialog() { set({ opponentLeftDialog: false }); },
  resetFleet() {
    set({
      playerBoard: EMPTY_BOARD(),
      placedShips: [],
      selectedShipType: SHIP_CATALOG[0].type,
      placementError: null,
    });
  },
}));

// ── Full state sync (reconnection / spectator join) ───────────────────────────

/** Resolve shooter username from a history entry — mirrors Android's multi-field fallback chain. */
function resolveShooterFromHistoryEntry(entry: Record<string, unknown>): string {
  for (const key of ['player', 'username', 'shooter', 'shooterUsername', 'firedBy']) {
    const v = typeof entry[key] === 'string' ? (entry[key] as string).trim() : '';
    if (v) return v;
  }
  return '';
}

function handleFullSync(
  data: Record<string, unknown>,
  myUsername: string,
  isSpectator: boolean,
  set: (s: Partial<BattleshipStoreState>) => void,
) {
  const playerBoard   = EMPTY_BOARD();
  const opponentBoard = EMPTY_BOARD();

  const p1 = (data.player1 as string) ?? '';
  const p2 = (data.player2 as string) ?? '';

  const boardOwner = isSpectator ? p1 : myUsername;

  // Reconstruct placed ships for participants (spectators have fog of war)
  const placedShips: PlacedShip[] = [];
  if (!isSpectator) {
    const ships = (data.ships as Record<string, unknown>[]) ?? [];
    ships.forEach(ship => {
      const cells = ship.cells as number[][] | undefined;
      const shipType = (ship.type as string) ?? '';
      const catalog = SHIP_CATALOG.find(s => s.type.toLowerCase() === shipType.toLowerCase());
      cells?.forEach(([r, c]) => {
        if (r >= 0 && r < 10 && c >= 0 && c < 10) playerBoard[r][c] = 'ship';
      });
      if (cells && cells.length > 0 && catalog) {
        const horizontal = cells.length > 1 ? cells[0][0] === cells[1][0] : true;
        placedShips.push({
          type: catalog.type,
          size: catalog.size,
          row: cells[0][0],
          col: cells[0][1],
          horizontal,
        });
      }
    });
  }

  // Replay shot history — boardOwner's shots → opponentBoard, other player's shots → playerBoard
  const history = (data.history as Record<string, unknown>[]) ?? [];
  const sunkEnemyShips: PlacedShip[] = [];

  history.forEach(shot => {
    const entry = shot as Record<string, unknown>;
    const shooter  = resolveShooterFromHistoryEntry(entry);
    const r        = entry.row as number;
    const c        = entry.col as number;
    const o        = ((entry.outcome as string) ?? 'miss').trim().toLowerCase();
    const shipType = typeof entry.shipType === 'string' ? (entry.shipType as string) : undefined;
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return;

    const isSunk = o === 'sunk';
    const isHit  = o === 'hit' || isSunk;
    const cell: BattleshipCell = isSunk ? 'sunk' : isHit ? 'hit' : 'miss';

    // Determine which board was targeted using defender fields or shooter identity
    const defender = (
      (typeof entry.defenderUsername === 'string' ? (entry.defenderUsername as string).trim() : '') ||
      (typeof entry.defender_username === 'string' ? (entry.defender_username as string).trim() : '') ||
      (typeof entry.targetUsername === 'string' ? (entry.targetUsername as string).trim() : '') ||
      (typeof entry.target_username === 'string' ? (entry.target_username as string).trim() : '')
    );

    let hitsPlayerBoard: boolean;
    if (defender) {
      hitsPlayerBoard = defender === boardOwner;
    } else if (shooter) {
      hitsPlayerBoard = shooter !== boardOwner;
    } else {
      return;
    }

    if (hitsPlayerBoard) {
      playerBoard[r][c] = cell;
      if (isSunk) deriveSunkShip(playerBoard, r, c, shipType);
    } else {
      opponentBoard[r][c] = cell;
      if (isSunk) {
        const derived = deriveSunkShip(opponentBoard, r, c, shipType);
        if (derived) sunkEnemyShips.push(derived);
      }
    }
  });

  const opponentName = p1 === myUsername ? p2 : p1;
  const spectatorOpponent = p1 === boardOwner ? p2 : p1;

  const syncTurnHolder = isSpectator
    ? ((data.turnOf as string | undefined)?.trim() ||
       (data.turn_of as string | undefined)?.trim() ||
       (data.currentPlayer as string | undefined)?.trim() ||
       p1)
    : undefined;

  set({
    phase: 'battle',
    playerBoard,
    opponentBoard,
    sunkEnemyShips,
    isMyTurn: isSpectator ? false : ((data.yourTurn as boolean) ?? false),
    opponentConfirmed: true,
    opponentName: isSpectator ? spectatorOpponent : opponentName,
    hasPendingFire: false,
    ...(placedShips.length > 0 ? { placedShips } : {}),
    ...(isSpectator ? {
      spectatorBoardOwner: boardOwner,
      spectatorFleetOwnerName: p1,
      spectatorOpponentFleetName: spectatorOpponent,
      spectatorCurrentPlayer: syncTurnHolder ?? p1,
    } : {}),
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
