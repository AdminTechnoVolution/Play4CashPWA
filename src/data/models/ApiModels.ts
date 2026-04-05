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
  refreshToken: string;
}

export interface UserAccountResponse {
  id: string;
  email: string;
  username: string;
  balance: number;
  totalRecharged: number;
  totalWithdrawal: number;
  totalWon: number;
  status: string;
  walletAddress?: string;
  wallet?: string;
  limits: { dailyWithdrawal: number };
}

// ─── Games ─────────────────────────────────────────────────────────────────────
export interface GameResponse {
  id: string;
  name: string;
  minBet: number;
  socketCode: string;
  turnTimer: number;
}

// ─── Rooms ─────────────────────────────────────────────────────────────────────
export type RoomStatus = 'waiting' | 'started' | 'finished';

export interface RoomPlayer {
  id: string;
  username: string;
}

export interface RoomResponse {
  id: string;
  name: string;
  players: RoomPlayer[];
  betAmount: number;
  status: RoomStatus;
  spectatorsCount: number;
  playerLimit: number;
  gameId: string;
}

export interface RoomStatusResponse {
  playerCount: number;
  currentPlayer?: string;
  winner?: string;
}

export interface RoomStatsResponse {
  playersOnline: number;
  activeGames: number;
  totalBet: number;
}

// ─── Requests ──────────────────────────────────────────────────────────────────
export interface CreateRoomRequest {
  gameId: string;
  betAmount: number;
  playerLimit: number;
  name: string;
}

export interface ShipPlacement {
  type: string;
  row: number;
  col: number;
  horizontal: boolean;
}

export interface BattleshipPlacementRequest {
  ships: ShipPlacement[];
}

export interface WithdrawalRequest {
  amount: number;
  walletAddress: string;
  network: string;
}

export interface VerifyWithdrawalRequest {
  code: string;
}

export interface RechargeRequest {
  txId: string;
  amount: number;
}

export interface RegisterWalletRequest {
  walletAddress: string;
  network: string;
}

// ─── Wallets ───────────────────────────────────────────────────────────────────
export interface WalletResponse {
  coin: string;
  address: string;
  minAmount: number;
  fee: number;
  network: string;
}

// ─── Greetings ─────────────────────────────────────────────────────────────────
export interface GreetingResponse {
  id: string;
  text: string;
}

// ─── History ───────────────────────────────────────────────────────────────────
export interface GameHistoryItem {
  id: string;
  opponent: string;
  result: 'win' | 'lose' | 'draw';
  prize: number;
  finishedAt: string;
  gameName: string;
}

export interface RechargeHistoryItem {
  id: string;
  amount: number;
  txId: string;
  status: string;
  createdAt: string;
}

export interface WithdrawalHistoryItem {
  id: string;
  amount: number;
  address: string;
  network: string;
  status: string;
  createdAt: string;
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
  phase: 'placement' | 'battle' | 'finished';
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

export type HalmaCell = 'empty' | 'mine' | 'opponent';

export interface HalmaState {
  board: HalmaCell[][];
  currentPlayer: string;
  myUsername: string;
  selectedCell?: { row: number; col: number };
  validMoves: { row: number; col: number }[];
  jumpTrail: { row: number; col: number }[];
  inJumpSequence: boolean;
  gameOver?: GameOverPayload;
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}
