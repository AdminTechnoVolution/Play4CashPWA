import { jwtDecode } from 'jwt-decode';
import { TOKEN_LEEWAY_S } from '../../config/api.config';
import { normaliseLang, detectBrowserLang } from '../../i18n/languageUtils';
import type { UserAccountResponse } from '../models/ApiModels';

const KEYS = {
  /** Legacy key; we read once for migration and then keep the token in memory. */
  ACCESS_TOKEN_LEGACY: 'p4c_access_token',
  /** Legacy refresh token key; refresh now lives in an httpOnly cookie. */
  REFRESH_TOKEN_LEGACY: 'p4c_refresh_token',
  USER_ACCOUNT: 'p4c_user_account',
  /** Monotonic counter bumped on each login/refresh/logout to drive cross-tab `storage` sync. */
  SESSION_VERSION: 'p4c_session_version',
  WALLET_ADDRESS: 'p4c_wallet_address',
  LANGUAGE: 'p4c_language',
} as const;

// ─── In-memory access token ─────────────────────────────────────────────────
// Access token is intentionally kept out of localStorage so it isn't readable by XSS
// or sticky in browser storage. Page reloads cause a single refresh roundtrip via
// the httpOnly refresh cookie (handled by `loadSession`).

let accessTokenMem: string | null = null;

(function migrateLegacyAccessToken(): void {
  try {
    const legacy = localStorage.getItem(KEYS.ACCESS_TOKEN_LEGACY);
    if (legacy) {
      accessTokenMem = legacy;
      localStorage.removeItem(KEYS.ACCESS_TOKEN_LEGACY);
    }
    localStorage.removeItem(KEYS.REFRESH_TOKEN_LEGACY);
  } catch {
    // SSR / non-browser: ignore.
  }
})();

// ─── Cross-tab broadcast ─────────────────────────────────────────────────────

type AuthBroadcastKind = 'login' | 'refresh' | 'logout';
type AuthBroadcastListener = (kind: AuthBroadcastKind) => void;
const broadcastListeners: AuthBroadcastListener[] = [];

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('p4c-auth');
    broadcastChannel.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { kind?: AuthBroadcastKind } | undefined;
      if (!data?.kind) return;
      for (const fn of broadcastListeners) fn(data.kind);
    });
  } catch {
    broadcastChannel = null;
  }
}

export function onAuthBroadcast(listener: AuthBroadcastListener): () => void {
  broadcastListeners.push(listener);
  return () => {
    const i = broadcastListeners.indexOf(listener);
    if (i >= 0) broadcastListeners.splice(i, 1);
  };
}

function notifyAuthChange(kind: AuthBroadcastKind): void {
  try {
    if (broadcastChannel) broadcastChannel.postMessage({ kind });
  } catch {
    // ignore
  }
  // Fallback: bump a localStorage counter so `storage` listeners in other tabs also fire.
  try {
    localStorage.setItem(KEYS.SESSION_VERSION, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Keys that imply auth/session changed in another tab (`storage` event). */
export function isCrossTabAuthStorageKey(key: string | null): boolean {
  return key === KEYS.USER_ACCOUNT || key === KEYS.SESSION_VERSION;
}

// ─── Token API ─────────────────────────────────────────────────────────────

/**
 * Persist the access token in memory only. Refresh is kept in an httpOnly cookie
 * set by the API. Broadcasts a refresh/login event to other tabs.
 */
export function saveTokens(token: string): void {
  const previous = accessTokenMem;
  accessTokenMem = token;
  try {
    localStorage.removeItem(KEYS.ACCESS_TOKEN_LEGACY);
    localStorage.removeItem(KEYS.REFRESH_TOKEN_LEGACY);
  } catch {
    // ignore
  }
  notifyAuthChange(previous ? 'refresh' : 'login');
}

export function getAccessToken(): string | null {
  return accessTokenMem;
}

/**
 * @deprecated Refresh is now httpOnly and not readable in JS.
 * Kept for backward compatibility; always returns `null`.
 */
export function getRefreshToken(): string | null {
  return null;
}

export function clearTokens(): void {
  const had = accessTokenMem !== null;
  accessTokenMem = null;
  try {
    localStorage.removeItem(KEYS.ACCESS_TOKEN_LEGACY);
    localStorage.removeItem(KEYS.REFRESH_TOKEN_LEGACY);
    localStorage.removeItem(KEYS.USER_ACCOUNT);
    localStorage.removeItem(KEYS.WALLET_ADDRESS);
  } catch {
    // ignore
  }
  if (had) notifyAuthChange('logout');
}

export function hasValidSession(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    if (!decoded.exp) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return decoded.exp - TOKEN_LEEWAY_S > nowSeconds;
  } catch {
    return false;
  }
}

// ─── User account (cached for fast UI bootstrap) ────────────────────────────

export function saveUserAccount(account: UserAccountResponse): void {
  try {
    localStorage.setItem(KEYS.USER_ACCOUNT, JSON.stringify(account));
  } catch {
    // ignore
  }
}

export function getUserAccount(): UserAccountResponse | null {
  try {
    const raw = localStorage.getItem(KEYS.USER_ACCOUNT);
    if (!raw) return null;
    return JSON.parse(raw) as UserAccountResponse;
  } catch {
    return null;
  }
}

export function saveWalletAddress(address: string): void {
  localStorage.setItem(KEYS.WALLET_ADDRESS, address);
}

export function getWalletAddress(): string | null {
  return localStorage.getItem(KEYS.WALLET_ADDRESS);
}

export function saveLanguage(lang: string): void {
  localStorage.setItem(KEYS.LANGUAGE, lang);
}

export function getLanguage(): string {
  const saved = localStorage.getItem(KEYS.LANGUAGE);
  return saved ? normaliseLang(saved) : detectBrowserLang();
}
