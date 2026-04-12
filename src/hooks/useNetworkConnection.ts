import { useCallback, useEffect, useState } from 'react';

type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

function getNetworkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const n = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return n.connection ?? n.mozConnection ?? n.webkitConnection;
}

export interface NetworkConnectionState {
  online: boolean;
  effectiveType: string;
  downlinkMbps: number | undefined;
  rttMs: number | undefined;
  saveData: boolean;
}

function readFromNavigator(): NetworkConnectionState {
  const c = getNetworkInformation();
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    effectiveType: typeof c?.effectiveType === 'string' ? c.effectiveType : '',
    downlinkMbps: typeof c?.downlink === 'number' && Number.isFinite(c.downlink) ? c.downlink : undefined,
    rttMs: typeof c?.rtt === 'number' && Number.isFinite(c.rtt) ? Math.round(c.rtt) : undefined,
    saveData: !!c?.saveData,
  };
}

/**
 * Online/offline + Network Information API when the browser exposes it (common on Chromium / Android WebView).
 * Not available on most Safari builds — UI should fall back gracefully.
 */
export function useNetworkConnection(): NetworkConnectionState {
  const [state, setState] = useState<NetworkConnectionState>(readFromNavigator);

  const sync = useCallback(() => {
    setState(readFromNavigator());
  }, []);

  useEffect(() => {
    const onOnline = () => sync();
    const onOffline = () => sync();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const c = getNetworkInformation();
    const onConnChange = () => sync();
    c?.addEventListener?.('change', onConnChange);
    sync();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      c?.removeEventListener?.('change', onConnChange);
    };
  }, [sync]);

  return state;
}
