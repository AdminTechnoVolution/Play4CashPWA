import { normaliseLang, detectBrowserLang } from '../../i18n/languageUtils';
import type { UserAccountResponse } from '../models/ApiModels';

const KEYS = {
  ACCESS_TOKEN_LEGACY: 'p4c_access_token',
  REFRESH_TOKEN_LEGACY: 'p4c_refresh_token',
  USER_ACCOUNT: 'p4c_user_account',
  SESSION_VERSION: 'p4c_session_version',
  WALLET_ADDRESS: 'p4c_wallet_address',
  LANGUAGE: 'p4c_language',
} as const;

type AuthBroadcastKind = 'login' | 'refresh' | 'logout';
type AuthBroadcastListener = (kind: AuthBroadcastKind) => void;
const broadcastListeners: AuthBroadcastListener[] = [];
let inMemoryAccessToken: string | null = null;

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

function notifyAuthChange(kind: AuthBroadcastKind): void {
  try {
    if (broadcastChannel) broadcastChannel.postMessage({ kind });
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(KEYS.SESSION_VERSION, String(Date.now()));
  } catch {
    // ignore
  }
}

export function onAuthBroadcast(listener: AuthBroadcastListener): () => void {
  broadcastListeners.push(listener);
  return () => {
    const i = broadcastListeners.indexOf(listener);
    if (i >= 0) broadcastListeners.splice(i, 1);
  };
}

export function isCrossTabAuthStorageKey(key: string | null): boolean {
  return key === KEYS.USER_ACCOUNT || key === KEYS.SESSION_VERSION;
}

export function saveTokens(_token: string): void {
  inMemoryAccessToken = _token;
  const hadAccount = getUserAccount() !== null;
  notifyAuthChange(hadAccount ? 'refresh' : 'login');
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getRefreshToken(): string | null {
  return null;
}

export function clearTokens(): void {
  inMemoryAccessToken = null;
  const hadAccount = getUserAccount() !== null;
  try {
    localStorage.removeItem(KEYS.ACCESS_TOKEN_LEGACY);
    localStorage.removeItem(KEYS.REFRESH_TOKEN_LEGACY);
    localStorage.removeItem(KEYS.USER_ACCOUNT);
    localStorage.removeItem(KEYS.WALLET_ADDRESS);
  } catch {
    // ignore
  }
  if (hadAccount) notifyAuthChange('logout');
}

export function hasValidSession(): boolean {
  return inMemoryAccessToken !== null;
}

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
