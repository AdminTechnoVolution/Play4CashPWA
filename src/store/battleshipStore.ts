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
}

interface BattleshipStoreActions {
  initGame: (roomId: string, myUsername: string, hasOpponent?: boolean, initialOpponentName?: string, isSpectator?: boolean) => void;
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
  isSpectator: false,
  spectatorBoardOwner: '',
  spectatorFleetOwnerName: '',
  spectatorOpponentFleetName: '',
  spectatorCurrentPlayer: '',
  spectatorsCount: 0,
  turnTimerSeconds: 30,
  shotCount: 0,

  // ── initGame ────────────────────────────────────────────────────────────────
  initGame(roomId, myUsername, hasOpponent = false, initialOpponentName = '', isSpectator = false) {
    console.log('[SPECTATOR][7] battleshipStore.initGame → roomId:', roomId, '| myUsername:', myUsername, '| isSpectator:', isSpectator, '| hasOpponent:', hasOpponent, '| initialOpponentName:', initialOpponentName);
    const socket = new BattleshipSocketManager();
    socket.connect(roomId);

    // Spectators join an active game — skip placement and treat opponent as confirmed
    if (isSpectator) {
      console.log('[SPECTATOR][7] Spectator mode → setting phase=battle, opponentConfirmed=true');
      set({ isSpectator: true, phase: 'battle', opponentConfirmed: true, opponentName: initialOpponentName });
    } else if (hasOpponent) {
      // Pre-seed opponent state when joining an existing room
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

      // ── Spectator count (broadcast on every event — mirrors Android applySpectatorBroadcast) ──
      const sc = typeof data.spectatorsCount === 'number' ? data.spectatorsCount
               : typeof data.spectators_count === 'number' ? data.spectators_count
               : -1;
      if (sc >= 0) set({ spectatorsCount: sc });

      // ── Spectator refresh: extract player names + turn holder from every event ──
      // Mirrors Android BattleshipViewModel.refreshSpectatorBattleshipUi()
      const spectatorMode = get().isSpectator;
      if (spectatorMode) {
        const { p1: ep1, p2: ep2, turnHolder } = extractSpectatorNamesFromPayload(data);
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
      const ships = data.ships;
      if (data.gameStarted && (spectatorMode || (Array.isArray(ships) && (ships as unknown[]).length > 0))) {
        console.log('[SPECTATOR][9] handleFullSync triggered → gameStarted:', data.gameStarted, '| isSpectator:', spectatorMode, '| player1:', data.player1, '| player2:', data.player2);
        handleFullSync(data, get().myUsername, spectatorMode, set);
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
        }
        return;
      }

      // ── Opponent joined ─────────────────────────────────────────────────────
      if (data.opponentJoined === true) {
        const name = ((data.userName ?? data.opponentName ?? 'Opponent') as string).trim();
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
          const { isSpectator: spec, hasPendingFire: pendingFire, spectatorBoardOwner: boardOwner } = get();
          const isDraw  = outcome === 'draw';
          const youWon  = !spec && (
            outcome === 'win' ||
            ((outcome === 'forfeit' || outcome === 'opponent_disconnected') &&
              (data.youWon as boolean ?? false))
          );
          const prize   = typeof data.prize === 'number' ? data.prize : undefined;
          const winner  = typeof data.winner === 'string' ? data.winner : undefined;
          // Derive end-reason: server `data.reason` takes priority, then map from outcome code
          const serverReason = typeof data.reason === 'string' && data.reason ? data.reason : undefined;
          const OUTCOME_TO_REASON: Record<string, string> = {
            forfeit: 'forfeit',
            opponent_disconnected: 'opponent_disconnected',
            timeout_loss: 'timeout_loss',
            match_cancelled: 'match_cancelled',
            win: 'all_sunk',
            lose: 'all_sunk',
          };
          const gameOverReason = serverReason ?? OUTCOME_TO_REASON[outcome];

          const pBoard = get().playerBoard.map(r => [...r]) as BattleshipCell[][];
          const oBoard = get().opponentBoard.map(r => [...r]) as BattleshipCell[][];

          let finalBoard: 'player' | 'opponent' = 'player';
          if (row >= 0 && col >= 0) {
            // Use same shot attribution logic as regular shots
            const finalShotFromPlayer1 = spec
              ? (shooter != null ? shooter === boardOwner : false)
              : pendingFire;
            finalBoard = finalShotFromPlayer1 ? 'opponent' : 'player';
            if (finalShotFromPlayer1) {
              oBoard[row][col] = 'sunk';
            } else {
              pBoard[row][col] = 'hit';
            }
          }

          set({
            phase: 'finished',
            playerBoard: pBoard,
            opponentBoard: oBoard,
            hasPendingFire: false,
            isMyTurn: false,
            animatingShot: row >= 0 ? { row, col, board: finalBoard } : null,
            gameOver: {
              outcome: isDraw ? 'draw' : youWon ? 'win' : 'lose',
              youWon,
              isDraw,
              winner,
              reason: gameOverReason,
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
        const { isSpectator, spectatorBoardOwner, hasPendingFire } = get();

        let shotBoard: 'player' | 'opponent' = 'player';
        if (row >= 0 && col >= 0) {
          // Determine if the shot came from the "playerBoard owner" or the "opponentBoard owner"
          // Spectator mode: use server-provided shooter; player mode: use hasPendingFire
          const isShotFromPlayer1 = isSpectator
            ? (shooter != null ? shooter === spectatorBoardOwner : false)
            : hasPendingFire;
          shotBoard = isShotFromPlayer1 ? 'opponent' : 'player';

          if (isShotFromPlayer1) {
            // Player1 shot → hit opponent board
            oBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
            if (!isSpectator) {
              shotMsg = outcome === 'sunk' && shipType
                ? `bs_outcome_you_sunk_${shipType.toLowerCase()}`
                : outcome === 'sunk' ? 'ws.games.shotSunk'
                : isHit ? 'ws.games.shotHit'
                : 'ws.games.shotMiss';
            }
          } else {
            // Player2 shot → hit player board
            pBoard[row][col] = outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
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
          hasPendingFire: false,
          isMyTurn: isSpectator ? false : (yourTurn ?? false),
          shotMessage: shotMsg,
          animatingShot: row >= 0 ? { row, col, board: shotBoard } : null,
          lastShot: row >= 0
            ? { row, col, result: outcome === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss' }
            : get().lastShot,
          shotCount: get().shotCount + 1,
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
      isSpectator: false,
      spectatorBoardOwner: '',
      spectatorFleetOwnerName: '',
      spectatorOpponentFleetName: '',
      spectatorCurrentPlayer: '',
      spectatorsCount: 0,
      turnTimerSeconds: 30,
      shotCount: 0,
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
      set({ placementError: 'bs_error_fit_left' });
      return;
    }
    if (!selectedHorizontal && row + catalog.size > 10) {
      set({ placementError: 'bs_error_fit_up' });
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
        set({ placementError: 'bs_error_occupied' });
        return;
      }
      newBoard[r][c] = 'ship';
    }

    const newPlacedShips = [...filtered, { type: selectedShipType, size: catalog.size, row, col, horizontal: selectedHorizontal }];

    // Auto-select the next unplaced ship in catalog order
    const nextShip = SHIP_CATALOG.find(s => !newPlacedShips.some(p => p.type === s.type));

    set({
      placedShips: newPlacedShips,
      playerBoard: newBoard,
      selectedShipType: nextShip?.type ?? null,
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
}));

// ── Full state sync (reconnection / spectator join) ───────────────────────────
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

  // For players: boardOwner = myUsername
  // For spectators: boardOwner = player1 (arbitrary assignment; player1 owns playerBoard)
  const boardOwner = isSpectator ? p1 : myUsername;

  if (!isSpectator) {
    // Re-mark own ships from the ships array (spectators have no ships)
    const ships = (data.ships as Record<string, unknown>[]) ?? [];
    ships.forEach(ship => {
      const cells = ship.cells as number[][] | undefined;
      cells?.forEach(([r, c]) => {
        if (r >= 0 && r < 10 && c >= 0 && c < 10) playerBoard[r][c] = 'ship';
      });
    });
  }

  // Replay shot history — boardOwner's shots hit the opponentBoard, the other player's shots hit playerBoard
  const history = (data.history as Record<string, unknown>[]) ?? [];
  history.forEach(shot => {
    const { player, row, col, outcome } = shot as Record<string, unknown>;
    const r = row as number;
    const c = col as number;
    const o = outcome as string;
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return;
    const isHit = o === 'hit' || o === 'sunk';
    const cell: BattleshipCell = o === 'sunk' ? 'sunk' : isHit ? 'hit' : 'miss';
    if (player === boardOwner) {
      opponentBoard[r][c] = cell; // boardOwner shot at opponent
    } else {
      playerBoard[r][c] = cell;   // opponent shot at boardOwner
    }
  });

  const opponentName = p1 === myUsername ? p2 : p1;
  const spectatorOpponent = p1 === boardOwner ? p2 : p1; // for spectators: the other player

  // For spectators: extract display names from the sync payload
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
    isMyTurn: isSpectator ? false : ((data.yourTurn as boolean) ?? false),
    opponentConfirmed: true,
    opponentName: isSpectator ? spectatorOpponent : opponentName,
    hasPendingFire: false,
    ...(isSpectator ? {
      spectatorBoardOwner: boardOwner,
      spectatorFleetOwnerName: p1,
      spectatorOpponentFleetName: spectatorOpponent,
      spectatorCurrentPlayer: syncTurnHolder ?? p1,
    } : {}),
  });
}

// ── Spectator payload parsing (mirrors Android SpectatorPayload helpers) ──────
/**
 * Extracts player display names and the current turn holder from a socket event payload.
 * Mirrors Android's SpectatorPayload.creatorOpponentUsernames(), parseSeats(), and
 * spectatorTurnHolderUsername() — with the same priority order.
 */
function extractSpectatorNamesFromPayload(
  data: Record<string, unknown>,
): { p1: string; p2: string; turnHolder: string } {
  let p1 = '';
  let p2 = '';

  // Priority 1: explicit player slots (most common in naval-battle events)
  const p1Slot = (data.player1 as string | undefined)?.trim()
    || (data.player_1 as string | undefined)?.trim()
    || (data.attackerUsername as string | undefined)?.trim()
    || (data.attacker_username as string | undefined)?.trim();
  const p2Slot = (data.player2 as string | undefined)?.trim()
    || (data.player_2 as string | undefined)?.trim()
    || (data.defenderUsername as string | undefined)?.trim()
    || (data.defender_username as string | undefined)?.trim();
  if (p1Slot) p1 = p1Slot;
  if (p2Slot) p2 = p2Slot;

  // Priority 2: players roster array (nested objects with playerId.username or user.username)
  if (!p1 || !p2) {
    const players = data.players as Record<string, unknown>[] | undefined;
    if (Array.isArray(players)) {
      players.forEach((entry, idx) => {
        const e = entry as Record<string, unknown>;
        const pid = e.playerId as Record<string, unknown> | undefined;
        const usr = e.user as Record<string, unknown> | undefined;
        const username = (
          (pid?.username as string | undefined)?.trim()
          || (usr?.username as string | undefined)?.trim()
          || (e.username as string | undefined)?.trim()
          || ''
        );
        if (idx === 0 && !p1 && username) p1 = username;
        if (idx === 1 && !p2 && username) p2 = username;
      });
    }
  }

  // Turn holder: turnOf → shot_from → isTurnOf → currentTurnUsername → currentPlayer
  const turnHolder = (
    (data.turnOf as string | undefined)?.trim()
    || (data.turn_of as string | undefined)?.trim()
    || (data.shotFrom as string | undefined)?.trim()
    || (data.shot_from as string | undefined)?.trim()
    || (data.isTurnOf as string | undefined)?.trim()
    || (data.is_turn_of as string | undefined)?.trim()
    || (data.currentTurnUsername as string | undefined)?.trim()
    || (data.current_turn_username as string | undefined)?.trim()
    || (data.currentPlayer as string | undefined)?.trim()
    || ''
  );

  return { p1, p2, turnHolder };
}

// ── Utility ───────────────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
