import { apiClient, bareClient } from './ApiClient';
import type {
  ApiResponse,
  LoginResponse,
  UserAccountResponse,
  GameResponse,
  GreetingResponse,
  WalletResponse,
  RoomStatsResponse,
  RoomResponse,
  RoomStatusResponse,
  CreateRoomRequest,
  BattleshipPlacementRequest,
  RegisterWalletRequest,
  RechargeRequest,
  WithdrawalRequest,
  VerifyWithdrawalRequest,
  RechargeHistoryItem,
  WithdrawalHistoryItem,
  GameHistoryItem,
} from '../models/ApiModels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(data: ApiResponse<T>): T {
  if (!data.success || data.data === undefined) {
    throw new Error(
      data.messages?.[0] ?? data.message ?? 'Unexpected empty response',
    );
  }
  return data.data;
}

export const apiService = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  // Android: POST /api/login with { token: String }

  async login(googleIdToken: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login', {
      token: googleIdToken,
    });
    return unwrap(res.data);
  },

  // Android: POST /api/login/refresh — optional body when refresh is only in httpOnly cookie
  async refreshToken(refreshToken?: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>(
      '/api/login/refresh',
      refreshToken ? { refreshToken } : {},
    );
    return unwrap(res.data);
  },

  // POST /api/logout — refresh from httpOnly cookie and/or body (native)
  async logout(refreshToken?: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      '/api/logout',
      refreshToken ? { refreshToken } : {},
    );
  },

  // ─── Account ───────────────────────────────────────────────────────────────
  // Android: GET /api/user/account

  async getUserAccount(): Promise<UserAccountResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>('/api/user/account');
    const raw = unwrap(res.data);
    return {
      id: raw._id ?? raw.id ?? '',
      email: raw.email ?? '',
      username: raw.username ?? '',
      balance: raw.balance ?? 0,
      walletAddress: raw.wallet_address?.wallet ?? raw.wallet ?? '',
      walletCoin: raw.wallet_address?.coin ?? 'USDT',
      walletNetwork: raw.wallet_address?.network ?? '',
      limits: raw.limits
        ? { dailyWithdrawal: raw.limits.daily_withdrawal ?? undefined }
        : undefined,
    };
  },

  // ─── Games ─────────────────────────────────────────────────────────────────
  // Android: GET /api/games

  async getGames(): Promise<GameResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/games');
    const raw = unwrap(res.data);
    return raw.map((g) => {
      const he = g.house_edge ?? g.houseEdge;
      const houseEdge =
        typeof he === 'number' && Number.isFinite(he) ? he : undefined;
      return {
        id: g._id ?? g.id ?? '',
        name: g.name ?? '',
        minBet: g.min_bet ?? 0,
        socketCode: g.socket_code ?? '',
        turnTimerSeconds: g.turn_timer_seconds ?? 0,
        defaultBets: g.default_bets ?? [],
        description: g.description ?? '',
        minPlayers: g.min_players ?? g.minPlayers ?? 2,
        maxPlayers: g.max_players ?? g.maxPlayers ?? 2,
        activeRooms: g.activeRooms ?? g.active_rooms ?? 0,
        houseEdge,
      };
    });
  },

  // ─── Greetings ─────────────────────────────────────────────────────────────
  // Android: GET /api/greetings

  async getGreetings(): Promise<GreetingResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/greetings');
    const raw = unwrap(res.data);
    return raw.map((g) => ({
      id: g._id ?? g.id ?? '',
      text: g.text ?? '',
    }));
  },

  // ─── Wallets ───────────────────────────────────────────────────────────────
  // Android: GET /api/wallets
  // Backend fields: { _id, coin, address, red, description, isActive, minAmount, networkWithdrawalFee }

  async getWallets(): Promise<WalletResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/wallets');
    const raw = unwrap(res.data);
    return raw.map((w) => {
      const network = w.red ?? '';
      const description = w.description ?? '';
      const displayLabel = network && description
        ? `${network} - ${description}`
        : network || description || (w.address ?? '').slice(0, 12) + '…';
      return {
        id: w._id ?? '',
        coin: w.coin ?? '',
        address: w.address ?? '',
        network,
        description,
        isActive: w.isActive ?? true,
        minAmount: w.minAmount ?? 0,
        fee: w.networkWithdrawalFee ?? 0,
        displayLabel,
      };
    });
  },

  // ─── Rooms ─────────────────────────────────────────────────────────────────
  // Android: GET /api/rooms/stats

  async getRoomStats(): Promise<RoomStatsResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>('/api/rooms/stats');
    const raw = unwrap(res.data);
    return {
      playersOnline: raw.playersOnline ?? 0,
      activeGames: raw.activeGames ?? 0,
      totalBetAmount: raw.totalBetAmount ?? 0,
    };
  },

  // Android: GET /api/rooms/game/{gameId}
  async getRooms(gameId: string): Promise<RoomResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>(`/api/rooms/game/${gameId}`);
    const raw = unwrap(res.data);
    return raw.map(normalizeRoom);
  },

  // Android: POST /api/rooms → returns { _id } only
  // Phase C: sends an `Idempotency-Key` (UUID) so a transparent retry (network
  // timeout, app backgrounded mid-flight) does NOT create a second room and a
  // second balance hold. The server caches the first response for ~5 minutes;
  // identical retries within that window replay the original result.
  async createRoom(req: CreateRoomRequest): Promise<string> {
    const idempKey =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.post<ApiResponse<any>>('/api/rooms', req, {
      headers: { 'Idempotency-Key': idempKey },
    });
    const data = unwrap(res.data);
    return data._id ?? data.id ?? '';
  },

  // Android: POST /api/rooms/{id}/join
  async joinRoom(roomId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/join`);
  },

  // Phase C: returns the room the user is currently participating in (waiting or
  // started) or `null` if none. Used on app boot to redirect a player back into
  // their active match without forcing a lobby search.
  async getActiveRoom(): Promise<RoomResponse | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any | null>>('/api/rooms/active');
    const raw = unwrap(res.data);
    if (!raw) return null;
    return normalizeRoom(raw);
  },

  // Android: POST /api/rooms/{id}/spectate
  async spectateRoom(roomId: string): Promise<void> {
    console.log('[SPECTATOR][1] ApiService.spectateRoom → POST /api/rooms/' + roomId + '/spectate');
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/spectate`);
    console.log('[SPECTATOR][1] ApiService.spectateRoom → 200 OK');
  },

  // Android: PATCH /api/rooms/{id}/ready with { ready: true }
  async readyRoom(roomId: string): Promise<void> {
    await apiClient.patch<ApiResponse<void>>(`/api/rooms/${roomId}/ready`, { ready: true });
  },

  // Android: POST /api/rooms/{id}/leave
  async leaveRoom(roomId: string): Promise<RoomStatusResponse> {
    const res = await apiClient.post<ApiResponse<RoomStatusResponse>>(`/api/rooms/${roomId}/leave`);
    return unwrap(res.data);
  },

  // Android: GET /api/rooms/{id}/status
  async getRoomStatus(roomId: string): Promise<RoomStatusResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>(`/api/rooms/${roomId}/status`);
    const raw = unwrap(res.data);
    return {
      id: raw.id ?? '',
      status: raw.status ?? '',
      playerCount:
        raw.playerCount ??
        raw.player_count ??
        (Array.isArray(raw.players) ? raw.players.length : 0) ??
        0,
      betAmount: raw.bet_amount,
      winner: raw.winner,
      winnerReason: raw.winner_reason,
    };
  },

  // ─── Battleship ────────────────────────────────────────────────────────────
  // Android: POST /api/rooms/{roomId}/battleship/placement
  // Transforms internal ShipPlacement → backend { type, startRow, startCol, isHorizontal, cells }

  async submitBattleshipPlacement(
    roomId: string,
    req: BattleshipPlacementRequest,
  ): Promise<void> {
    const ships = req.ships.map((s) => {
      const size = (s as unknown as { size?: number }).size ?? 1;
      const cells: number[][] = [];
      for (let i = 0; i < size; i++) {
        cells.push(s.horizontal ? [s.row, s.col + i] : [s.row + i, s.col]);
      }
      return {
        type: s.type.toLowerCase(),
        startRow: s.row,
        startCol: s.col,
        isHorizontal: s.horizontal,
        cells,
      };
    });
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/battleship/placement`, { ships });
  },

  // ─── Wallet / Finance ──────────────────────────────────────────────────────
  // Android: POST /api/user/register-wallet with { wallet, coin, network }

  async registerWallet(req: RegisterWalletRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/user/register-wallet', req);
  },

  // Android: POST /api/transactions/recharge with { txId, amount, coin }
  async recharge(req: RechargeRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/transactions/recharge', req);
  },

  // Android: POST /api/transactions/withdrawal with { amount } only
  async withdrawal(req: WithdrawalRequest): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/transactions/withdrawal', req);
    if (!res.data?.success) {
      throw new Error(res.data?.message ?? res.data?.messages?.[0] ?? 'error_try_later_message');
    }
  },

  // Android: POST /api/transactions/verify-withdrawal with { verification_code }
  async verifyWithdrawal(req: VerifyWithdrawalRequest): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>('/api/transactions/verify-withdrawal', req);
    if (!res.data?.success) {
      throw new Error(res.data?.messages?.[0] ?? res.data?.message ?? 'error_try_later_message');
    }
  },

  // ─── History ───────────────────────────────────────────────────────────────
  // Android: GET /api/transactions/recharge/history

  async getRechargeHistory(): Promise<RechargeHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/transactions/recharge/history');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      amount: item.amount ?? 0,
      coin: item.coin ?? 'USDT',
      txId: item.txId,
      wallet: item.wallet ?? '',
      network: item.network ?? '',
      status: item.status ?? '',
      createdAt: item.created_at ?? item.createdAt ?? '',
    }));
  },

  // Android: GET /api/transactions/withdrawal/history
  async getWithdrawalHistory(): Promise<WithdrawalHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/transactions/withdrawal/history');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      amount: item.amount ?? 0,
      coin: item.coin ?? 'USDT',
      wallet: item.wallet ?? '',
      network: item.network ?? '',
      txFee: item.tx_fee,
      status: item.status ?? '',
      createdAt: item.created_at ?? item.createdAt ?? '',
    }));
  },

  // Android: GET /api/user/history
  async getGameHistory(): Promise<GameHistoryItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any[]>>('/api/user/history');
    const raw = unwrap(res.data);
    return raw.map((item) => ({
      roomId: item.room_id ?? '',
      gameName: item.game_name ?? '',
      gameCode: item.game_code ?? '',
      betAmount: item.bet_amount ?? 0,
      result: item.result ?? '',
      prize: item.prize ?? 0,
      opponentName: item.opponent?.username ?? '',
      finishedAt: item.finished_at ?? item.date ?? '',
    }));
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRoom(raw: any): RoomResponse {
  const players = (raw.players ?? []).map((p: any) => {
    const ref = p.playerId ?? p.user ?? p;
    return {
      id: ref._id ?? ref.id ?? '',
      username: ref.username ?? '',
    };
  });
  return {
    id: raw._id ?? raw.id ?? '',
    name: raw.name ?? '',
    players,
    betAmount: raw.bet_amount ?? 0,
    status: (raw.status ?? raw.roomStatus ?? raw.room_status ?? '').toLowerCase(),
    spectatorsCount: raw.spectatorsCount ?? raw.spectators_count ?? 0,
    gameId: raw.game_id?._id ?? raw.game_id ?? undefined,
    // Phase C: populated game lets the PWA build the play URL on its own — needed
    // by the "active room" deep-link on app boot to know which `/play/<code>` to open.
    socketCode: raw.game_id?.socket_code ?? raw.socketCode ?? undefined,
    playerLimit: raw.player_limit ?? raw.playerLimit ?? raw.maxPlayers ?? 2,
  };
}
