export const SUPPORTED_LANGS = ['es', 'en', 'fr', 'de', 'it', 'pt'] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const DEFAULT_LANG: SupportedLang = 'en';

/**
 * Normalises any browser / API language tag (e.g. "es-MX", "pt-BR", "en-US")
 * to one of the supported short codes.  Returns the default if unrecognised.
 */
export function normaliseLang(raw: string | undefined | null): SupportedLang {
  const short = (raw ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(short)
    ? (short as SupportedLang)
    : DEFAULT_LANG;
}

/** Detects the user's preferred language from the browser. */
export function detectBrowserLang(): SupportedLang {
  return normaliseLang(navigator.language);
}
