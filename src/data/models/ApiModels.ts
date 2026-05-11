// ─── Response wrapper ─────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  messages?: string[];
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  token: string;
  /** Still returned for native clients; browser PWA uses httpOnly cookie instead of persisting this. */
  refreshToken?: string;
}

// ─── Account ──────────────────────────────────────────────────────────────────
// Normalized (camelCase) — ApiService maps from backend snake_case
export interface UserAccountResponse {
  id: string;
  email: string;
  username: string;
  balance: number;
  walletAddress: string;
  walletCoin: string;
  walletNetwork: string;
  limits?: { dailyWithdrawal?: number };
}

// ─── Games ─────────────────────────────────────────────────────────────────────
// Normalized — ApiService maps _id→id, min_bet→minBet, socket_code→socketCode, etc.
export interface GameResponse {
  id: string;
  name: string;
  description: string;
  minBet: number;
  socketCode: string;
  turnTimerSeconds: number;
  defaultBets: number[];
  minPlayers: number;
  maxPlayers: number;
  activeRooms: number;
  /** Commission (%) in UI. Percentage points (e.g. 5 = 5%). From API `house_edge`. */
  houseEdge?: number;
}

// ─── Rooms ─────────────────────────────────────────────────────────────────────
export interface RoomPlayer {
  id: string;
  username: string;
}

// Normalized — ApiService maps _id→id, bet_amount→betAmount, players nesting
export interface RoomResponse {
  id: string;
  name: string;
  players: RoomPlayer[];
  betAmount: number;
  status: string;
  spectatorsCount: number;
  gameId?: string;
  playerLimit: number;
}

export interface RoomStatusResponse {
  id: string;
  status: string;
  playerCount: number;
  betAmount?: number;
  winner?: string;
  winnerReason?: string;
}

// Normalized — ApiService maps players_online→playersOnline, etc.
export interface RoomStatsResponse {
  playersOnline: number;
  activeGames: number;
  totalBetAmount: number;
}

// ─── Request bodies — exact backend field names ────────────────────────────────

// POST /api/rooms — Android: { game_id, bet_amount, public, name, player_limit? }
export interface CreateRoomRequest {
  game_id: string;
  bet_amount: number;
  public: boolean;
  name: string;
  player_limit?: number;
}

// Internal ship placement shape used by battleshipStore
export interface ShipPlacement {
  type: string;
  row: number;
  col: number;
  horizontal: boolean;
}

// POST /api/rooms/{id}/battleship/placement
// ApiService transforms ShipPlacement → backend format { startRow, startCol, isHorizontal, cells }
export interface BattleshipPlacementRequest {
  ships: ShipPlacement[];
}

// POST /api/transactions/withdrawal — Android: { amount: Int } only
export interface WithdrawalRequest {
  amount: number;
}

// POST /api/transactions/verify-withdrawal — Android: { verification_code: String }
export interface VerifyWithdrawalRequest {
  verification_code: string;
}

// POST /api/transactions/recharge — Android: { txId, amount, coin: "usdt" }
export interface RechargeRequest {
  txId: string;
  amount: number;
  coin: string;
}

// POST /api/user/register-wallet — Android: { wallet, coin, network }
export interface RegisterWalletRequest {
  wallet: string;
  coin: string;
  network: string;
}

// ─── Wallets ───────────────────────────────────────────────────────────────────
// Normalized — ApiService maps red→network, networkWithdrawalFee→fee
export interface WalletResponse {
  id: string;
  coin: string;
  address: string;
  network: string;
  description: string;
  isActive: boolean;
  minAmount: number;
  fee: number;
  displayLabel: string;
}

// ─── Greetings ─────────────────────────────────────────────────────────────────
// Normalized — ApiService maps _id→id
export interface GreetingResponse {
  id: string;
  text: string;
}

// ─── History ───────────────────────────────────────────────────────────────────
// Normalized — ApiService maps created_at→createdAt, etc.
export interface RechargeHistoryItem {
  amount: number;
  coin: string;
  txId?: string;
  wallet: string;
  network: string;
  status: string;
  createdAt: string;
}

export interface WithdrawalHistoryItem {
  amount: number;
  coin: string;
  wallet: string;
  network: string;
  txFee?: number;
  status: string;
  createdAt: string;
}

export interface GameHistoryItem {
  roomId: string;
  gameName: string;
  gameCode: string;
  betAmount: number;
  result: string;
  prize: number;
  opponentName: string;
  finishedAt: string;
}

// ─── Socket game state ─────────────────────────────────────────────────────────
export interface GameOverPayload {
  outcome: 'win' | 'lose' | 'draw';
  youWon: boolean;
  isDraw: boolean;
  winner?: string;
  reason?: string;
  prize?: number;
}

export type BattleshipCell = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface BattleshipState {
  myBoard: BattleshipCell[][];
  opponentBoard: BattleshipCell[][];
  currentPlayer: string;
  phase: 'placement' | 'waiting' | 'battle' | 'finished';
  gameOver?: GameOverPayload;
  lastShot?: { row: number; col: number; result: 'hit' | 'miss' | 'sunk' };
}

export type ChessPiece =
  | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP'
  | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP'
  | null;

export interface ChessState {
  board: ChessPiece[][];
  currentPlayer: 'white' | 'black';
  myColor: 'white' | 'black';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  canCastleKingside: boolean;
  canCastleQueenside: boolean;
  gameOver?: GameOverPayload;
}

export interface DominoTile {
  a: number;
  b: number;
}

export interface DominoBoardTile extends DominoTile {
  orientation: 'horizontal' | 'vertical';
  flipped: boolean;
}

export interface DominoState {
  myHand: DominoTile[];
  opponents: { username: string; tileCount: number }[];
  board: DominoBoardTile[];
  leftEnd: number;
  rightEnd: number;
  boneyardCount: number;
  currentPlayer: string;
  myUsername: string;
  gameOver?: GameOverPayload;
}

export type HalmaCell = 'empty' | 'mine' | 'opponent' | 'mine_king' | 'opponent_king';

export type HalmaPhase = 'WAITING' | 'PLAY' | 'GAME_OVER';

export interface HalmaState {
  board: HalmaCell[][];
  currentPlayer: string;
  myUsername: string;
  phase: HalmaPhase;
  statusMessage?: string;
  turnTimeLeft?: number;
  selectedCell?: { row: number; col: number };
  validMoves: { row: number; col: number; isJump?: boolean }[];
  jumpTrail: { row: number; col: number }[];
  inJumpSequence: boolean;
  mustEndTurn?: boolean;
  pendingCaptures?: { row: number; col: number }[];
  gameOver?: GameOverPayload;
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}
