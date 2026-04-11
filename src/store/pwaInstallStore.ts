import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void;
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
}

export const usePWAInstallStore = create<PWAInstallStore>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  isInstalled: window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true,

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

  dismiss: () => set({ isInstallable: false }),
}));
