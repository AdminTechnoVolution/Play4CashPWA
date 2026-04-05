import esJson from './es.json';
import enJson from './en.json';
import frJson from './fr.json';
import deJson from './de.json';
import itJson from './it.json';
import ptJson from './pt.json';
import { useLanguageStore } from './languageStore';

export type SupportedLang = 'es' | 'en' | 'fr' | 'de' | 'it' | 'pt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL: Record<SupportedLang, any> = { es: esJson, en: enJson, fr: frJson, de: deJson, it: itJson, pt: ptJson };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolve(dict: any, fallback: any, key: string): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') { cur = null; break; }
    cur = cur[p];
  }
  if (typeof cur === 'string') return cur;

  // fallback to EN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fb: any = fallback;
  for (const p of parts) {
    if (fb == null || typeof fb !== 'object') return key;
    fb = fb[p];
  }
  return typeof fb === 'string' ? fb : key;
}

/** Reactive hook — re-renders whenever language changes */
export function useT() {
  const lang = useLanguageStore((s) => s.lang) as SupportedLang;
  const dict = ALL[lang] ?? ALL['en'];
  return (key: string) => resolve(dict, ALL['en'], key);
}

/** Non-reactive helper for use outside components (e.g. legal layout titles) */
export function t(key: string): string {
  const lang = useLanguageStore.getState().lang as SupportedLang;
  const dict = ALL[lang] ?? ALL['en'];
  return resolve(dict, ALL['en'], key);
}
