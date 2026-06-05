import { apiService } from './ApiService';
import { getAccessToken } from '../auth/AuthSessionStore';
import type {
  LoginResponse,
  UserAccountResponse,
  GameResponse,
  GreetingResponse,
  WalletResponse,
  RoomStatsResponse,
  RoomResponse,
  RoomStatusResponse,
  PublicUserStatsResponse,
  CreateRoomRequest,
  BattleshipPlacementRequest,
  RequestWalletChangePayload,
  ConfirmWalletChangeRequest,
  RechargeRequest,
  WithdrawalRequest,
  VerifyWithdrawalRequest,
  RechargeHistoryItem,
  WithdrawalHistoryItem,
  GameHistoryItem,
  TournamentHistoryItem,
  TournamentSummary,
  TournamentBracketResponse,
  ContactUsSubmitPayload,
  ContactUsSubmitResponse,
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

  async refreshToken(refreshToken?: string): Promise<LoginResponse> {
    return apiService.refreshToken(refreshToken);
  },

  async logout(refreshToken?: string): Promise<void> {
    return apiService.logout(refreshToken);
  },

  async getPublicUserStats(): Promise<PublicUserStatsResponse> {
    return apiService.getPublicUserStats();
  },

  // ─── Account ───────────────────────────────────────────────────────────────

  async getUserAccount(): Promise<UserAccountResponse> {
    // Never serve a cached account when there is no in-memory access token: that would
    // make protected pages render with a "fantom" user after logout / token expiry.
    if (!getAccessToken()) {
      accountCache = null;
      return apiService.getUserAccount();
    }
    if (accountCache && accountCache.expiresAt > Date.now()) {
      return accountCache.data;
    }
    const account = await apiService.getUserAccount();
    accountCache = { data: account, expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS };
    return account;
  },

  getCachedUserAccount(): UserAccountResponse | null {
    if (!getAccessToken()) return null;
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

  /** Phase C: returns the user's active room (waiting/started) or `null`. */
  async getActiveRoom(): Promise<RoomResponse | null> {
    return apiService.getActiveRoom();
  },

  async createRoom(req: CreateRoomRequest): Promise<string> {
    return apiService.createRoom(req);
  },

  async joinRoom(roomId: string): Promise<void> {
    return apiService.joinRoom(roomId);
  },

  async spectateRoom(roomId: string): Promise<void> {
    console.log('[SPECTATOR][2] ApiRepository.spectateRoom → roomId:', roomId);
    return apiService.spectateRoom(roomId);
  },

  async readyRoom(roomId: string): Promise<void> {
    return apiService.readyRoom(roomId);
  },

  async roomReady(roomId: string): Promise<void> {
    return apiService.readyRoom(roomId);
  },

  async leaveRoom(roomId: string): Promise<RoomStatusResponse> {
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

  async requestWalletChange(req: RequestWalletChangePayload): Promise<void> {
    return apiService.requestWalletChange(req);
  },

  async confirmWalletChange(req: ConfirmWalletChangeRequest): Promise<void> {
    try {
      await apiService.confirmWalletChange(req);
    } finally {
      accountCache = null;
    }
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

  async getTournamentHistory(): Promise<TournamentHistoryItem[]> {
    return apiService.getTournamentHistory();
  },

  async getTournaments(): Promise<TournamentSummary[]> {
    return apiService.getTournaments();
  },

  async getMyTournaments(): Promise<TournamentSummary[]> {
    return apiService.getMyTournaments();
  },

  async getTournament(id: string): Promise<TournamentSummary> {
    return apiService.getTournament(id);
  },

  async getTournamentBracket(id: string): Promise<TournamentBracketResponse> {
    return apiService.getTournamentBracket(id);
  },

  async registerTournament(id: string): Promise<unknown> {
    return apiService.registerTournament(id);
  },

  async unregisterTournament(id: string): Promise<unknown> {
    return apiService.unregisterTournament(id);
  },

  async savePushSubscription(sub: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<void> {
    return apiService.savePushSubscription(sub);
  },

  async removePushSubscription(endpoint: string): Promise<void> {
    return apiService.removePushSubscription(endpoint);
  },

  // ─── Contact Us ──────────────────────────────────────────────────────────────

  async submitContactUs(req: ContactUsSubmitPayload): Promise<ContactUsSubmitResponse> {
    return apiService.submitContactUs(req);
  },
};
