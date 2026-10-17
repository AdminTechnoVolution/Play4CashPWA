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

/** `GET /api/user/public/stats` — no auth */
export interface PublicUserStatsResponse {
  registeredUsers: number;
}

// ─── Games ─────────────────────────────────────────────────────────────────────
// Normalized — ApiService maps _id→id, min_bet→minBet, socket_code→socketCode, etc.
export interface GameResponse {
  id: string;
  name: string;
  description: string;
  /** Localized bullet rules for catalog / lobby modals. */
  rules?: string[];
  minBet: number;
  socketCode: string;
  turnTimerSeconds: number;
  defaultBets: number[];
  minPlayers: number;
  maxPlayers: number;
  activeRooms: number;
  /** Commission (%) in UI. Percentage points (e.g. 5 = 5%). From API `house_edge`. */
  houseEdge?: number;
  /** UNO: points to win the match (from catalog `uno_match_target` / `unoMatchTarget`). */
  unoMatchTarget?: number;
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
  /** Phase C: socket code of the underlying game (e.g. 'uno', 'chess'). Present
   *  when the API populates `game_id`, used by the active-room deep-link to
   *  build `/play/<socketCode>/<roomId>` without an extra lookup. */
  socketCode?: string;
  playerLimit: number;
}

export interface RoomStatusResponse {
  id: string;
  status: string;
  playerCount: number;
  /** Maximum number of players accepted by the room, when supplied by the API. */
  playerLimit?: number;
  betAmount?: number;
  winner?: string;
  winnerReason?: string;
}

export interface RoomStateResponse {
  roomId: string;
  gameId: string;
  gameSocketCode: string;
  status: string;
  players: RoomPlayer[];
  currentPlayers: number;
  requiredPlayers: number;
  isCurrentUserInRoom: boolean;
  canEnterPlay: boolean;
  playPath: string | null;
  betAmount: number;
  roomName: string;
  updatedAt: string | null;
  startedAt: string | null;
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
  bet_amount: number | string;
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

// POST /api/transactions/recharge — Android: { txId, coin: "usdt" }
export interface RechargeRequest {
  txId: string;
  coin: string;
  /** Stable per-submit key so retries do not duplicate the recharge. */
  idempotencyKey?: string;
}

// POST /api/transactions/recharge/intent — reserves an exact deposit amount before funds are sent.
export interface RechargeIntentRequest {
  coin: string;
  network: string;
  amount: number;
}

export interface RechargeIntentResponse {
  intentId: string;
  coin: string;
  network: string;
  /** Shared platform wallet address to send funds to. */
  address: string;
  /** Exact amount (with a small unique fingerprint) the user must send. */
  exactAmount: number;
  /** Reservation deadline — the intent stops being claimable after this. */
  expiresAt: string;
}

// POST /api/user/request-wallet-change — { wallet, coin, network }; OTP emailed.
export interface RequestWalletChangePayload {
  wallet: string;
  coin: string;
  network: string;
}

// POST /api/user/confirm-wallet-change
export interface ConfirmWalletChangeRequest {
  verification_code: string;
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
  lostAmount?: number;
  opponentNames: string[];
  finishedAt: string;
  auditAdjustment?: {
    kind: 'balance_removed' | 'balance_refunded';
    amount: number;
    reason: string;
    createdAt: string;
    affectedUsernames: string[];
  } | null;
}

export interface TournamentHistoryItem {
  id: string;
  title: string;
  gameSocketCode: string;
  status: string;
  buyIn: number;
  maxPlayers: number;
  registeredCount: number;
  grossPrizePool: number;
  houseFeePercent?: number;
  firstPlacePercent?: number;
  firstPlaceAmount?: number;
  secondPlaceAmount?: number;
  participantStatus: string;
  finalRank: number | null;
  prizeAmount: number;
  finishedAt: string | null;
  startedAt: string;
}

// ─── Socket game state ─────────────────────────────────────────────────────────
export interface GameOverPayload {
  /** `match_cancelled`: the match never started (stakes refunded); no result. */
  outcome: 'win' | 'lose' | 'draw' | 'match_cancelled';
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

// ─── UNO ───────────────────────────────────────────────────────────────────────

/** Card colors in UNO. R=red, G=green, B=blue, Y=yellow. */
export type UnoColor = 'R' | 'G' | 'B' | 'Y';

/**
 * Compact card encoding shared with the API:
 * - Numbered colored: `${Color}${0..9}`         e.g. 'R5', 'G0'
 * - Action colored:    `${Color}Skip|Reverse|Draw2`  e.g. 'YSkip', 'BReverse', 'GDraw2'
 * - Wild:              'W'  (choose color)
 * - Wild +4:           'W4' (choose color, target draws 4)
 */
export type UnoCardCode = string;

/** Server payload shape for the UNO `uno` socket event (success branch). */
export interface UnoGamePayload {
  hand: UnoCardCode[];
  handCount: Record<string, number>;
  topDiscard: UnoCardCode | null;
  discardCount: number;
  drawPileCount: number;
  currentColor: UnoColor;
  direction: 1 | -1;
  currentPlayerIndex: number;
  currentTurnPlayerId: string;
  currentTurnUsername: string;
  yourTurn: boolean;
  turnTimerSeconds: number;
  drawStackPending: number;
  playerOrder: string[];
  usernames: Record<string, string>;
  waitingForOpponent: boolean;
  gameStarted: boolean;
  isSpectator: boolean;
  eliminatedPlayers: string[];
  /** Players currently holding a valid UNO declaration (1 card + called). */
  unoCalled: string[];
  /** Player who just landed at 1 card without saying UNO. Anyone can challenge them. */
  pendingUnoOffender: string | null;
  /** Last player who took an action (play, draw, take stack, pass). */
  lastActionPlayerId: string | null;
  lastActionUsername: string | null;
  /** Set when a `call_uno` event has just been processed. */
  unoCallerId?: string;
  unoCallerName?: string;
  /** Set when a `challenge_uno_miss` succeeded. */
  unoChallenge?: {
    accuserId: string;
    accuserName: string;
    offenderId: string;
    offenderName: string;
    penalty: number;
  };

  // ── Multi-round (Phase 2) ──────────────────────────────────────────────
  /** Cumulative score per player across rounds in this match. */
  matchScores: Record<string, number>;
  /** 1-indexed round counter. */
  roundNumber: number;
  /** Score required to win the match. */
  matchTargetScore: number;
  /** Set once a player reaches `matchTargetScore`. */
  matchWinnerId: string | null;
  /** True between rounds — clients render the scoreboard with countdown. */
  betweenRounds: boolean;
  /** ISO string deadline for auto-starting the next round. */
  nextRoundStartsAt: string | null;
  /** Players who tapped "ready" for the next round. */
  playersReadyForNext: string[];
  /** Audit log of completed rounds. Used by the scoreboard panel. */
  roundHistory: { round: number; winnerId: string; scoreDealt: number; endedAt: string | null }[];

  /** Round-end deltas (set when `roundEnded === true`). */
  roundEnded?: boolean;
  roundWinnerId?: string;
  roundWinnerUsername?: string;
  roundScoreDealt?: number;

  /** Set when a new round just started. */
  roundStarted?: boolean;

  /** Match-end (overrides round-end). `gameEnded` already true. */
  matchEnded?: boolean;
  prize?: number;

  gameEnded?: boolean;
  /** True when the player timed out but the match continues to the next round. */
  eliminatedFromRound?: boolean;
  winner?: string;
  reason?: string;
  outcome?: string;
  spectatorsCount?: number;
}

// ─── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

// ─── Tournaments ─────────────────────────────────────────────────────────────
export interface TournamentMyActiveMatch {
  matchId: string;
  status: string;
  roomId: string | null;
  roundName: string;
  opponentUsername: string | null;
  presenceCheckAt: string | null;
  canJoin: boolean;
  needsLobby: boolean;
}

export interface TournamentSummary {
  id: string;
  title: string;
  description: string;
  gameSocketCode: string;
  status: string;
  buyIn: number;
  maxPlayers: number;
  registeredCount: number;
  startsAt: string;
  serverNow: string;
  remainingMs: number;
  pauseRemainingMs: number | null;
  turnTimerSeconds: number;
  grossPrizePool: number;
  houseFeePercent?: number;
  firstPlacePercent?: number;
  secondPlacePercent?: number;
  firstPlaceAmount?: number;
  secondPlaceAmount?: number;
  myRegistration?: { status: string; seed?: number; groupNumber?: number } | null;
  myActiveMatch?: TournamentMyActiveMatch | null;
}

export interface TournamentBracketMatch {
  id: string;
  groupNumber: number | null;
  phase?: string;
  roundName: string;
  roundIndex?: number;
  matchIndex?: number;
  status: string;
  playerA: { userId: string; username: string } | null;
  playerB: { userId: string; username: string } | null;
  winnerUserId: string | null;
  roomId: string | null;
  isBye?: boolean;
}

export interface TournamentBracketParticipant {
  userId: string;
  username: string;
  seed?: number;
  status?: string;
}

export interface TournamentBracketGroup {
  groupNumber: number;
  status: string;
  winnerUserId: string | null;
  participants?: TournamentBracketParticipant[];
}

export interface TournamentBracketResponse {
  groups: TournamentBracketGroup[];
  groupMatches: TournamentBracketMatch[];
  finalsMatches: TournamentBracketMatch[];
}

// ─── Contact Us ───────────────────────────────────────────────────────────────
export type ContactUsType = 'comment' | 'suggestion' | 'error';

export interface ContactUsSubmitPayload {
  type: ContactUsType;
  message: string;
  game_ids: string[];
  all_games: boolean;
}

export interface ContactUsSubmitResponse {
  id: string;
}

export type ContactRequestStatus = 'new' | 'read' | 'resolved';

export interface ContactRequestItem {
  id: string;
  type: ContactUsType;
  message: string;
  allGames: boolean;
  gameLabels: string[];
  status: ContactRequestStatus;
  reviewResponse: string;
  createdAt: string;
  updatedAt: string;
}
