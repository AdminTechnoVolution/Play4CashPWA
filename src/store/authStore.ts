import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import {
  refreshAccessTokenWithLock,
  emitAuthFailureEvent,
  requestRefreshCookieCleared,
} from '../data/network/ApiClient';
import {
  saveTokens,
  clearTokens,
  hasValidSession,
  saveUserAccount,
  getUserAccount,
  getAccessToken,
  isCrossTabAuthStorageKey,
  onAuthBroadcast,
} from '../data/auth/AuthSessionStore';
import { clearRoutingContext } from '../util/routingStorage';
import { formatApiMessageForDisplay } from '../i18n/ApiMessageDisplay';
import type { UserAccountResponse } from '../data/models/ApiModels';

interface AuthState {
  user: UserAccountResponse | null;
  isLoading: boolean;
  /** True after the first `loadSession` run finishes (or early-exits). Avoids flashing login before hydration. */
  authHydrated: boolean;
  error: string | null;
  signInWithGoogle: (idToken: string) => Promise<void>;
  loadSession: () => Promise<void>;
  logout: () => Promise<void>;
  syncUser: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Token refresh failed, 401 unrecoverable, or socket auth failure — clear cookie, storage, UI
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

  // Other tabs: logout, login, refresh, or session clear — sync this tab.
  // We listen to BroadcastChannel (primary) AND a `storage` "session version" key (fallback
  // for older browsers / Private mode where BroadcastChannel may be missing).
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
      if (!hasValidSession()) {
        // We can't see the httpOnly refresh cookie in JS, so we always try one refresh on cold
        // start. The API responds 401 if there is no cookie (or it's invalid), and we treat that
        // as "logged out" without firing a noisy auth-failure event.
        const likelyHadSession = !!getAccessToken() || !!getUserAccount();
        try {
          await refreshAccessTokenWithLock();
        } catch {
          if (likelyHadSession) {
            emitAuthFailureEvent();
          } else {
            set({ user: null, isLoading: false, authHydrated: true, error: null });
          }
          return;
        }
      }

      if (!hasValidSession()) {
        set({ user: null, isLoading: false, authHydrated: true });
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
        set({ user: account, error: null });
      } catch {
        // If API fails, use cached account if available
        if (cached) {
          set({ user: cached });
        } else {
          set({ user: null });
        }
      } finally {
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
