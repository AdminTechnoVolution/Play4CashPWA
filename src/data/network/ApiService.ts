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

  // Android: POST /api/login/refresh with { refreshToken }
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login/refresh', {
      refreshToken,
    });
    return unwrap(res.data);
  },

  // Android: POST /api/logout with { refreshToken }
  async logout(refreshToken: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/logout', { refreshToken });
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
    return raw.map((g) => ({
      id: g._id ?? g.id ?? '',
      name: g.name ?? '',
      minBet: g.min_bet ?? 0,
      socketCode: g.socket_code ?? '',
      turnTimerSeconds: g.turn_timer_seconds ?? 0,
      defaultBets: g.default_bets ?? [],
    }));
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
    return raw.map((w) => ({
      id: w._id ?? '',
      coin: w.coin ?? '',
      address: w.address ?? '',
      network: w.red ?? '',           // red is the network name in the backend
      description: w.description ?? '',
      minAmount: w.minAmount ?? 0,
      fee: w.networkWithdrawalFee ?? 0,
    }));
  },

  // ─── Rooms ─────────────────────────────────────────────────────────────────
  // Android: GET /api/rooms/stats

  async getRoomStats(): Promise<RoomStatsResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>('/api/rooms/stats');
    const raw = unwrap(res.data);
    return {
      playersOnline: raw.players_online ?? raw.playersOnline ?? raw.online_players ?? 0,
      activeGames: raw.active_games ?? raw.activeGames ?? raw.active_rooms ?? raw.activeRooms ?? 0,
      totalBet: raw.total_bet_amount ?? raw.totalBet ?? raw.total_bet ?? 0,
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
  async createRoom(req: CreateRoomRequest): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.post<ApiResponse<any>>('/api/rooms', req);
    const data = unwrap(res.data);
    return data._id ?? data.id ?? '';
  },

  // Android: POST /api/rooms/{id}/join
  async joinRoom(roomId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/join`);
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
  async leaveRoom(roomId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/leave`);
  },

  // Android: GET /api/rooms/{id}/status
  async getRoomStatus(roomId: string): Promise<RoomStatusResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await apiClient.get<ApiResponse<any>>(`/api/rooms/${roomId}/status`);
    const raw = unwrap(res.data);
    return {
      id: raw.id ?? '',
      status: raw.status ?? '',
      playerCount: raw.playerCount ?? 0,
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
    await apiClient.post<ApiResponse<void>>('/api/transactions/withdrawal', req);
  },

  // Android: POST /api/transactions/verify-withdrawal with { verification_code }
  async verifyWithdrawal(req: VerifyWithdrawalRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/transactions/verify-withdrawal', req);
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
    playerLimit: raw.player_limit ?? raw.playerLimit ?? raw.maxPlayers ?? 2,
  };
}
