import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Minutes between background `swRegistration.update()` polls. iOS standalone uses /4. */
const UPDATE_CHECK_INTERVAL_MIN = 60;
const UPDATE_CHECK_INTERVAL_MIN_STANDALONE = 15;

/**
 * Manual SW update check (same as the periodic poll in `useRegisterSW`).
 * Safe from pull-to-refresh; does not reload. If a new worker is waiting,
 * `useAppUpdate` / `AppUpdateModal` will surface `needRefresh`.
 */
export async function checkServiceWorkerForUpdate(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  } catch {
    /* ignore network / unsupported */
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari legacy.
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

/** localStorage flag so the install-ready toast only fires once per browser/install. */
const OFFLINE_READY_SEEN_KEY = 'p4c_install_ready_seen';

export interface AppUpdateState {
  /** A new SW has finished installing in the background. Show the prompt. */
  needRefresh: boolean;
  /** App install completed for this browser/install. */
  offlineReady: boolean;
  /** Set to true when the API forces an upgrade via X-App-Min-Version header. */
  forced: boolean;
  /** Optional version pushed by the API as required minimum. */
  requiredVersion: string | null;
  appVersion: string;
  appFullVersion: string;
  buildTime: string;
  isStandalone: boolean;
  /** True when install-ready fires AND we haven't shown the toast yet on this device. */
  showOfflineReady: boolean;
  /** Apply the new SW and reload. Resolves after reload is triggered. */
  applyUpdate: () => Promise<void>;
  /** Hide the update prompt for this session (does NOT install the update). */
  dismiss: () => void;
  /** Mark the install-ready toast as seen so it never fires again on this device. */
  dismissOfflineReady: () => void;
}

/**
 * Glue between vite-plugin-pwa's SW lifecycle and a UI prompt.
 * Listens for forced-update events emitted by ApiClient when the API responds with
 * `X-App-Min-Version` greater than the running app's version.
 */
export function useAppUpdate(): AppUpdateState {
  const standalone = isStandalone();
  const [forced, setForced] = useState(false);
  const [requiredVersion, setRequiredVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [offlineReadyDismissed, setOfflineReadyDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OFFLINE_READY_SEEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const intervalMin = standalone ? UPDATE_CHECK_INTERVAL_MIN_STANDALONE : UPDATE_CHECK_INTERVAL_MIN;

  const {
    needRefresh: [needRefreshRaw, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodic background check so long-lived sessions detect deploys.
      window.setInterval(() => {
        registration.update().catch(() => { /* network errors are fine */ });
      }, intervalMin * 60 * 1000);
    },
  });

  useEffect(() => {
    function onForce(e: Event) {
      const detail = (e as CustomEvent<{ requiredVersion?: string }>).detail;
      setRequiredVersion(detail?.requiredVersion ?? null);
      setForced(true);
      setDismissed(false);
    }
    window.addEventListener('p4c:force-update', onForce as EventListener);
    return () => window.removeEventListener('p4c:force-update', onForce as EventListener);
  }, []);

  const applyUpdate = async (): Promise<void> => {
    const reg =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    const hadWaitingWorker = Boolean(reg?.waiting);

    try {
      await updateServiceWorker(true);
    } catch {
      window.location.reload();
      return;
    }

    // Forced API upgrade / no pending SW: `messageSkipWaiting` is a no-op — reload to fetch new HTML.
    if (!hadWaitingWorker) {
      window.location.reload();
      return;
    }

    // Prompt-mode SW update: reload immediately races activation (`skipWaiting` is async; optional
    // claim may lag). Wait for controller swap or fall back so one tap reliably picks up the build.
    await new Promise<void>((resolve) => {
      const ms = 12_000;
      const timer = window.setTimeout(resolve, ms);
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

    window.location.reload();
  };

  return {
    needRefresh: !dismissed && (needRefreshRaw || forced),
    offlineReady,
    forced,
    requiredVersion,
    appVersion: __APP_VERSION__,
    appFullVersion: __APP_FULL_VERSION__,
    buildTime: __APP_BUILD_TIME__,
    isStandalone: standalone,
    showOfflineReady: offlineReady && !offlineReadyDismissed,
    applyUpdate,
    dismiss: () => {
      // Forced updates can't be dismissed.
      if (forced) return;
      setDismissed(true);
      setNeedRefresh(false);
    },
    dismissOfflineReady: () => {
      setOfflineReadyDismissed(true);
      try {
        localStorage.setItem(OFFLINE_READY_SEEN_KEY, '1');
      } catch {
        /* ignore quota/private mode */
      }
    },
  };
}
