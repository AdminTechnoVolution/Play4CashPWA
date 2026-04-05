import { jwtDecode } from 'jwt-decode';
import { TOKEN_LEEWAY_S } from '../../config/api.config';
import type { UserAccountResponse } from '../models/ApiModels';

const KEYS = {
  ACCESS_TOKEN: 'p4c_access_token',
  REFRESH_TOKEN: 'p4c_refresh_token',
  USER_ACCOUNT: 'p4c_user_account',
  WALLET_ADDRESS: 'p4c_wallet_address',
  LANGUAGE: 'p4c_language',
} as const;

export function saveTokens(token: string, refreshToken: string): void {
  localStorage.setItem(KEYS.ACCESS_TOKEN, token);
  localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.REFRESH_TOKEN);
}

export function clearTokens(): void {
  localStorage.removeItem(KEYS.ACCESS_TOKEN);
  localStorage.removeItem(KEYS.REFRESH_TOKEN);
  localStorage.removeItem(KEYS.USER_ACCOUNT);
  localStorage.removeItem(KEYS.WALLET_ADDRESS);
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

export function saveUserAccount(account: UserAccountResponse): void {
  localStorage.setItem(KEYS.USER_ACCOUNT, JSON.stringify(account));
}

export function getUserAccount(): UserAccountResponse | null {
  const raw = localStorage.getItem(KEYS.USER_ACCOUNT);
  if (!raw) return null;
  try {
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
  return localStorage.getItem(KEYS.LANGUAGE) ?? 'es';
}
