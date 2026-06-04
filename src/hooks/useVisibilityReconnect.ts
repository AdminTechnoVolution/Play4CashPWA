import { useEffect } from 'react';
import { reconnectAllStaleSockets } from '../data/network/socketRegistry';
import { resyncActivePlaySession } from '../util/playRoomSession';

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
 * Bug A: also handles `pageshow` (bfcache) and re-join/sync on active /play routes;
 * invalid rooms redirect home via `handleRoomGone` without the forfeit money modal.
 *
 * Mount once at the App root.
 */
export function useVisibilityReconnect(): void {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      reconnectAllStaleSockets();
      void resyncActivePlaySession();
    };

    const onPageShow = (ev: PageTransitionEvent) => {
      if (!ev.persisted) return;
      reconnectAllStaleSockets();
      void resyncActivePlaySession();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onPageShow);
    onVisible();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
}
