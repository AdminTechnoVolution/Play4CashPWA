import { create } from 'zustand';
import { getLanguage, saveLanguage } from '../data/auth/AuthSessionStore';

interface LanguageStore {
  lang: string;
  setLang: (lang: string) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  lang: getLanguage(),
  setLang: (lang) => {
    saveLanguage(lang);
    set({ lang });
  },
}));
