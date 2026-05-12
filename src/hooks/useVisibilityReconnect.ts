import { useEffect } from 'react';
import { reconnectAllStaleSockets } from '../data/network/socketRegistry';

/**
 * Phase D: bridges browser visibility/focus into the socket layer.
 *
 * Why this matters: mobile browsers (iOS Safari especially) freeze JS timers and
 * tear down WebSocket transports when the PWA is backgrounded for >30 seconds.
 * socket.io's built-in reconnection only resumes on the next tick after the tab
 * regains focus, which can leave the user staring at a stale state for several
 * seconds. Manually poking `socket.connect()` on `visibilitychange` cuts that to
 * roughly one RTT.
 *
 * Mount once at the App root.
 */
export function useVisibilityReconnect(): void {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        reconnectAllStaleSockets();
      }
    };
    // `visibilitychange` covers backgrounding on mobile and tab switch on desktop.
    // `focus` adds an extra safety net for browsers that don't fire visibilitychange
    // when the OS hands focus back (some Android WebViews).
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    // Also kick once on mount in case we landed here after a long device sleep.
    handler();
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);
}
