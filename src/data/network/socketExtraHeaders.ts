import { getLanguage } from '../auth/AuthSessionStore';

/**
 * Short language tag for `Accept-Language` on all game / lobby Socket.IO connections.
 * Already normalised by `getLanguage()` via `languageUtils.normaliseLang`.
 */
export function acceptLanguageTag(): string {
  return getLanguage();
}

/**
 * Standard handshake headers: JWT, locale (required for translated socket messages), and
 * the running app's semver so the Gateway can reject sockets from clients below
 * `PWA_MIN_VERSION` before bridging to the API.
 */
export function socketIoExtraHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'accept-language': acceptLanguageTag(),
    'X-App-Version': __APP_VERSION__,
  };
}

/**
 * Auth payload pushed alongside the headers. `extraHeaders` is ignored by the websocket
 * transport in some browsers, so we duplicate the version here as well.
 */
export function socketIoAuthPayload(accessToken: string): Record<string, string> {
  return {
    token: accessToken,
    appVersion: __APP_VERSION__,
  };
}
