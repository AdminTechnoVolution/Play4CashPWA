import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import { saveUserAccount } from '../data/auth/AuthSessionStore';
import type { UserAccountResponse, GameResponse, RoomStatsResponse } from '../data/models/ApiModels';

interface DashboardState {
  account: UserAccountResponse | null;
  games: GameResponse[];
  roomStats: RoomStatsResponse | null;
  isLoading: boolean;
  error: string | null;
  loadDashboard: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  account: null,
  games: [],
  roomStats: null,
  isLoading: false,
  error: null,

  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      apiRepository.invalidateAccountCache();
      const [account, games, roomStats] = await Promise.all([
        apiRepository.getUserAccount(),
        apiRepository.getGames(),
        apiRepository.getRoomStats(),
      ]);
      saveUserAccount(account);
      set({ account, games, roomStats, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard.';
      set({ isLoading: false, error: msg });
    }
  },

  refreshAccount: async () => {
    try {
      apiRepository.invalidateAccountCache();
      const account = await apiRepository.getUserAccount();
      saveUserAccount(account);
      set({ account });
    } catch {
      // Silently ignore refresh errors
    }
  },

  clearError: () => set({ error: null }),
}));
