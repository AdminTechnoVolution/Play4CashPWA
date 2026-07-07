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

export const useDashboardStore = create<DashboardState>((set) => ({
  account: null,
  games: [],
  roomStats: null,
  isLoading: false,
  error: null,

  loadDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const cachedAccount = apiRepository.getCachedUserAccount();
      const account = cachedAccount ?? await apiRepository.getUserAccount();
      saveUserAccount(account);
      useAuthStore.getState().syncUser();

      const [gamesResult, roomStatsResult] = await Promise.allSettled([
        apiRepository.getGames(),
        apiRepository.getRoomStats(),
      ]);

      const nextState: Partial<DashboardState> = { account, isLoading: false };
      if (gamesResult.status === 'fulfilled') {
        nextState.games = gamesResult.value;
      }
      if (roomStatsResult.status === 'fulfilled') {
        nextState.roomStats = roomStatsResult.value;
      }
      set(nextState);
    } catch (err: any) {
      set({ isLoading: false, error: formatApiMessageForDisplay(err) });
    }
  },

  refreshAccount: async () => {
    try {
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
