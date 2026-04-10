import { getLanguage } from '../auth/AuthSessionStore';

/**
 * Short language tag for `Accept-Language` on all game / lobby Socket.IO connections.
 * Aligns with `ChatSocketManager` (first two letters, default `en`).
 */
export function acceptLanguageTag(): string {
  return getLanguage().toLowerCase().slice(0, 2).trim() || 'en';
}

/** Standard handshake headers: JWT + locale (required by backend for translated socket messages). */
export function socketIoExtraHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'accept-language': acceptLanguageTag(),
  };
}
