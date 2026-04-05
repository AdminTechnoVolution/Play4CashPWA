import { apiService } from './ApiService';
import type {
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

const ACCOUNT_CACHE_TTL_MS = 30_000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let accountCache: CacheEntry<UserAccountResponse> | null = null;

export const apiRepository = {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  async login(googleIdToken: string): Promise<LoginResponse> {
    return apiService.login(googleIdToken);
  },

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return apiService.refreshToken(refreshToken);
  },

  async logout(refreshToken: string): Promise<void> {
    return apiService.logout(refreshToken);
  },

  // ─── Account ───────────────────────────────────────────────────────────────

  async getUserAccount(): Promise<UserAccountResponse> {
    if (accountCache && accountCache.expiresAt > Date.now()) {
      return accountCache.data;
    }
    const account = await apiService.getUserAccount();
    accountCache = { data: account, expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS };
    return account;
  },

  getCachedUserAccount(): UserAccountResponse | null {
    if (accountCache && accountCache.expiresAt > Date.now()) {
      return accountCache.data;
    }
    return null;
  },

  invalidateAccountCache(): void {
    accountCache = null;
  },

  // ─── Games ─────────────────────────────────────────────────────────────────

  async getGames(): Promise<GameResponse[]> {
    return apiService.getGames();
  },

  // ─── Greetings ─────────────────────────────────────────────────────────────

  async getGreetings(): Promise<GreetingResponse[]> {
    return apiService.getGreetings();
  },

  // ─── Wallets ───────────────────────────────────────────────────────────────

  async getWallets(): Promise<WalletResponse[]> {
    return apiService.getWallets();
  },

  // ─── Rooms ─────────────────────────────────────────────────────────────────

  async getRoomStats(): Promise<RoomStatsResponse> {
    return apiService.getRoomStats();
  },

  async getRooms(gameId: string): Promise<RoomResponse[]> {
    return apiService.getRooms(gameId);
  },

  async createRoom(req: CreateRoomRequest): Promise<string> {
    return apiService.createRoom(req);
  },

  async joinRoom(roomId: string): Promise<void> {
    return apiService.joinRoom(roomId);
  },

  async spectateRoom(roomId: string): Promise<void> {
    return apiService.spectateRoom(roomId);
  },

  async readyRoom(roomId: string): Promise<void> {
    return apiService.readyRoom(roomId);
  },

  async leaveRoom(roomId: string): Promise<void> {
    return apiService.leaveRoom(roomId);
  },

  async getRoomStatus(roomId: string): Promise<RoomStatusResponse> {
    return apiService.getRoomStatus(roomId);
  },

  // ─── Battleship ────────────────────────────────────────────────────────────

  async submitBattleshipPlacement(
    roomId: string,
    req: BattleshipPlacementRequest,
  ): Promise<void> {
    return apiService.submitBattleshipPlacement(roomId, req);
  },

  // ─── Wallet / Finance ──────────────────────────────────────────────────────

  async registerWallet(req: RegisterWalletRequest): Promise<void> {
    return apiService.registerWallet(req);
  },

  async recharge(req: RechargeRequest): Promise<void> {
    return apiService.recharge(req);
  },

  async withdrawal(req: WithdrawalRequest): Promise<void> {
    return apiService.withdrawal(req);
  },

  async verifyWithdrawal(req: VerifyWithdrawalRequest): Promise<void> {
    return apiService.verifyWithdrawal(req);
  },

  // ─── History ───────────────────────────────────────────────────────────────

  async getRechargeHistory(): Promise<RechargeHistoryItem[]> {
    return apiService.getRechargeHistory();
  },

  async getWithdrawalHistory(): Promise<WithdrawalHistoryItem[]> {
    return apiService.getWithdrawalHistory();
  },

  async getGameHistory(): Promise<GameHistoryItem[]> {
    return apiService.getGameHistory();
  },
};
