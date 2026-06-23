import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import {
  emitAuthFailureEvent,
  requestRefreshCookieCleared,
} from '../data/network/ApiClient';
import {
  saveTokens,
  clearTokens,
  saveUserAccount,
  getAccessToken,
  getUserAccount,
  isCrossTabAuthStorageKey,
  onAuthBroadcast,
} from '../data/auth/AuthSessionStore';
import { clearRoutingContext } from '../util/routingStorage';
import { formatApiMessageForDisplay } from '../i18n/ApiMessageDisplay';
import type { UserAccountResponse } from '../data/models/ApiModels';

interface AuthState {
  user: UserAccountResponse | null;
  isLoading: boolean;
  authHydrated: boolean;
  error: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  loadSession: () => Promise<void>;
  logout: () => Promise<void>;
  syncUser: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  window.addEventListener('p4c:auth-failure', () => {
    void (async () => {
      await requestRefreshCookieCleared();
      clearTokens();
      clearRoutingContext();
      apiRepository.invalidateAccountCache();
      set({
        user: null,
        isLoading: false,
        authHydrated: true,
        error: formatApiMessageForDisplay('Your session has expired. Please sign in again.'),
      });
    })();
  });

  if (typeof window !== 'undefined') {
    const w = window as Window & { __p4cAuthCrossTab?: boolean };
    if (!w.__p4cAuthCrossTab) {
      w.__p4cAuthCrossTab = true;

      let crossTabDebounce: ReturnType<typeof setTimeout> | null = null;
      const triggerSync = () => {
        if (crossTabDebounce) clearTimeout(crossTabDebounce);
        crossTabDebounce = setTimeout(() => {
          crossTabDebounce = null;
          apiRepository.invalidateAccountCache();
          void get().loadSession();
        }, 50);
      };

      onAuthBroadcast(triggerSync);

      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.storageArea !== localStorage || !isCrossTabAuthStorageKey(e.key)) return;
        triggerSync();
      });
    }
  }

  return {
    user: null,
    isLoading: false,
    authHydrated: false,
    error: null,

    syncUser: () => {
      const account = getUserAccount();
      if (account) {
        set({ user: account });
      }
    },

    signInWithGoogle: async (idToken: string) => {
      set({ isLoading: true, error: null });
      try {
        const loginData = await apiRepository.login(idToken);
        saveTokens(loginData.token);
        const account = await apiRepository.getUserAccount();
        saveUserAccount(account);
        set({ user: account, isLoading: false, authHydrated: true, error: null });
      } catch (err: any) {
        set({ isLoading: false, authHydrated: true, error: formatApiMessageForDisplay(err) });
        throw err;
      }
    },

    loadSession: async () => {
      apiRepository.invalidateAccountCache();
      const tokenAtStart = getAccessToken();
      set({ isLoading: true });
      try {
        const account = await apiRepository.getUserAccount();
        if (getAccessToken() !== tokenAtStart) {
          return;
        }
        saveUserAccount(account);
        set({ user: account, isLoading: false, authHydrated: true, error: null });
      } catch (err) {
        if (getAccessToken() !== tokenAtStart) {
          return;
        }
        const reason = err instanceof Error ? err.message : '';
        if (reason === 'error_session_expired') {
          clearTokens();
          set({ user: null, isLoading: false, authHydrated: true });
          emitAuthFailureEvent();
          return;
        }
        set({ isLoading: false, authHydrated: true });
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await apiRepository.logout();
      } catch {
        // Ignore logout API errors; clear session regardless
      } finally {
        await requestRefreshCookieCleared();
        clearTokens();
        clearRoutingContext();
        apiRepository.invalidateAccountCache();
        set({ user: null, isLoading: false, error: null });
      }
    },

    clearError: () => set({ error: null }),
  };
});
