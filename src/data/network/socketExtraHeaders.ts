import { getLanguage } from '../auth/AuthSessionStore';

export function acceptLanguageTag(): string {
  return getLanguage();
}

export function socketIoExtraHeaders(): Record<string, string> {
  return {
    'accept-language': acceptLanguageTag(),
    'X-App-Version': __APP_VERSION__,
  };
}

export function socketIoAuthPayload(token?: string): Record<string, string> {
  return {
    ...(token ? { token } : {}),
    appVersion: __APP_VERSION__,
  };
}
