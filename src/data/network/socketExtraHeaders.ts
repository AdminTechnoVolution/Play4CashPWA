import { getLanguage } from '../auth/AuthSessionStore';

/**
 * Short language tag for `Accept-Language` on all game / lobby Socket.IO connections.
 * Already normalised by `getLanguage()` via `languageUtils.normaliseLang`.
 */
export function acceptLanguageTag(): string {
  return getLanguage();
}

/** Standard handshake headers: JWT + locale (required by backend for translated socket messages). */
export function socketIoExtraHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'accept-language': acceptLanguageTag(),
  };
}
