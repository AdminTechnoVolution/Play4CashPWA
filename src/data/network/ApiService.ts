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

  async login(googleIdToken: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login/google', {
      idToken: googleIdToken,
    });
    return unwrap(res.data);
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const res = await bareClient.post<ApiResponse<LoginResponse>>('/api/login/refresh', {
      refreshToken,
    });
    return unwrap(res.data);
  },

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/login/logout', { refreshToken });
  },

  // ─── Account ───────────────────────────────────────────────────────────────

  async getUserAccount(): Promise<UserAccountResponse> {
    const res = await apiClient.get<ApiResponse<UserAccountResponse>>('/api/users/me');
    return unwrap(res.data);
  },

  // ─── Games ─────────────────────────────────────────────────────────────────

  async getGames(): Promise<GameResponse[]> {
    const res = await apiClient.get<ApiResponse<GameResponse[]>>('/api/games');
    return unwrap(res.data);
  },

  // ─── Greetings ─────────────────────────────────────────────────────────────

  async getGreetings(): Promise<GreetingResponse[]> {
    const res = await apiClient.get<ApiResponse<GreetingResponse[]>>('/api/greetings');
    return unwrap(res.data);
  },

  // ─── Wallets ───────────────────────────────────────────────────────────────

  async getWallets(): Promise<WalletResponse[]> {
    const res = await apiClient.get<ApiResponse<WalletResponse[]>>('/api/wallets');
    return unwrap(res.data);
  },

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  async getRoomStats(): Promise<RoomStatsResponse> {
    const res = await apiClient.get<ApiResponse<RoomStatsResponse>>('/api/rooms/stats');
    return unwrap(res.data);
  },

  async getRooms(gameId: string): Promise<RoomResponse[]> {
    const res = await apiClient.get<ApiResponse<RoomResponse[]>>('/api/rooms', {
      params: { gameId },
    });
    return unwrap(res.data);
  },

  async createRoom(req: CreateRoomRequest): Promise<RoomResponse> {
    const res = await apiClient.post<ApiResponse<RoomResponse>>('/api/rooms', req);
    return unwrap(res.data);
  },

  async joinRoom(roomId: string): Promise<RoomResponse> {
    const res = await apiClient.post<ApiResponse<RoomResponse>>(`/api/rooms/${roomId}/join`);
    return unwrap(res.data);
  },

  async spectateRoom(roomId: string): Promise<RoomResponse> {
    const res = await apiClient.post<ApiResponse<RoomResponse>>(`/api/rooms/${roomId}/spectate`);
    return unwrap(res.data);
  },

  async readyRoom(roomId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/ready`);
  },

  async leaveRoom(roomId: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/leave`);
  },

  async getRoomStatus(roomId: string): Promise<RoomStatusResponse> {
    const res = await apiClient.get<ApiResponse<RoomStatusResponse>>(
      `/api/rooms/${roomId}/status`,
    );
    return unwrap(res.data);
  },

  // ─── Battleship ────────────────────────────────────────────────────────────

  async submitBattleshipPlacement(
    roomId: string,
    req: BattleshipPlacementRequest,
  ): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`/api/rooms/${roomId}/battleship/placement`, req);
  },

  // ─── Wallet / Finance ──────────────────────────────────────────────────────

  async registerWallet(req: RegisterWalletRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/wallets/register', req);
  },

  async recharge(req: RechargeRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/recharges', req);
  },

  async withdrawal(req: WithdrawalRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/withdrawals', req);
  },

  async verifyWithdrawal(req: VerifyWithdrawalRequest): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/api/withdrawals/verify', req);
  },

  // ─── History ───────────────────────────────────────────────────────────────

  async getRechargeHistory(): Promise<RechargeHistoryItem[]> {
    const res = await apiClient.get<ApiResponse<RechargeHistoryItem[]>>('/api/recharges/history');
    return unwrap(res.data);
  },

  async getWithdrawalHistory(): Promise<WithdrawalHistoryItem[]> {
    const res = await apiClient.get<ApiResponse<WithdrawalHistoryItem[]>>(
      '/api/withdrawals/history',
    );
    return unwrap(res.data);
  },

  async getGameHistory(): Promise<GameHistoryItem[]> {
    const res = await apiClient.get<ApiResponse<GameHistoryItem[]>>('/api/games/history');
    return unwrap(res.data);
  },
};
