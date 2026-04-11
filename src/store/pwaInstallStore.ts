import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const IS_STANDALONE =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;

const IS_IOS_SAFARI = IS_IOS && !IS_STANDALONE;

const DISMISS_KEY = 'pwa-install-dismissed';

function wasDismissedRecently(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Date.now() - Number(ts) < 7 * DAY_MS;
}

interface PWAInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isIOSSafari: boolean;
  isInstalled: boolean;
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void;
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
}

export const usePWAInstallStore = create<PWAInstallStore>((set, get) => ({
  deferredPrompt: null,
  isInstallable: IS_IOS_SAFARI && !wasDismissedRecently(),
  isIOSSafari: IS_IOS_SAFARI,
  isInstalled: IS_STANDALONE,

  setDeferredPrompt: (e) => set({ deferredPrompt: e, isInstallable: !!e }),

  triggerInstall: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      set({ isInstalled: true });
    }
    set({ deferredPrompt: null, isInstallable: false });
  },

  dismiss: () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    set({ isInstallable: false });
  },
}));
