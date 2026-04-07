import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import {
  saveTokens,
  clearTokens,
  hasValidSession,
  saveUserAccount,
  getUserAccount,
  getRefreshToken,
} from '../data/auth/AuthSessionStore';
import { formatApiMessageForDisplay } from '../i18n/ApiMessageDisplay';
import type { UserAccountResponse } from '../data/models/ApiModels';

interface AuthState {
  user: UserAccountResponse | null;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  loadSession: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for auth failure events (token refresh failed, 401 unrecoverable)
  window.addEventListener('p4c:auth-failure', () => {
    clearTokens();
    set({ user: null, isLoading: false, error: formatApiMessageForDisplay('Your session has expired. Please sign in again.') });
  });

  return {
    user: null,
    isLoading: false,
    error: null,

    signInWithGoogle: async (idToken: string) => {
      set({ isLoading: true, error: null });
      try {
        const loginData = await apiRepository.login(idToken);
        saveTokens(loginData.token, loginData.refreshToken);
        const account = await apiRepository.getUserAccount();
        saveUserAccount(account);
        set({ user: account, isLoading: false, error: null });
      } catch (err: any) {
        set({ isLoading: false, error: formatApiMessageForDisplay(err) });
        throw err;
      }
    },

    loadSession: async () => {
      if (!hasValidSession()) {
        set({ user: null, isLoading: false });
        return;
      }
      set({ isLoading: true });
      // Load cached account immediately for fast rendering
      const cached = getUserAccount();
      if (cached) {
        set({ user: cached });
      }
      try {
        const account = await apiRepository.getUserAccount();
        saveUserAccount(account);
        set({ user: account, isLoading: false, error: null });
      } catch {
        // If API fails, use cached account if available
        if (cached) {
          set({ user: cached, isLoading: false });
        } else {
          set({ user: null, isLoading: false });
        }
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          await apiRepository.logout(refreshToken);
        }
      } catch {
        // Ignore logout API errors; clear session regardless
      } finally {
        clearTokens();
        apiRepository.invalidateAccountCache();
        set({ user: null, isLoading: false, error: null });
      }
    },

    clearError: () => set({ error: null }),
  };
});
