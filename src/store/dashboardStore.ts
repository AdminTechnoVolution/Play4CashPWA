import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import { saveUserAccount } from '../data/auth/AuthSessionStore';
import { useAuthStore } from './authStore';
import { formatApiMessageForDisplay } from '../i18n/ApiMessageDisplay';
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

const SYNC_DELAY_MS = 500;

export const useDashboardStore = create<DashboardState>((set) => ({
  account: null,
  games: [],
  roomStats: null,
  isLoading: false,
  error: null,

  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      // Add a small delay to allow backend to finalize balance after a game
      await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));

      apiRepository.invalidateAccountCache();
      const [account, games, roomStats] = await Promise.all([
        apiRepository.getUserAccount(),
        apiRepository.getGames(),
        apiRepository.getRoomStats(),
      ]);
      saveUserAccount(account);
      useAuthStore.getState().syncUser();
      set({ account, games, roomStats, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: formatApiMessageForDisplay(err) });
    }
  },

  refreshAccount: async () => {
    try {
      // Add a small delay to allow backend to finalize balance after a game
      await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));

      apiRepository.invalidateAccountCache();
      const account = await apiRepository.getUserAccount();
      saveUserAccount(account);
      useAuthStore.getState().syncUser();
      set({ account });
    } catch {
      // Silently ignore refresh errors
    }
  },

  clearError: () => set({ error: null }),
}));
