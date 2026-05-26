import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getRuntimeEnv } from '../config/runtimeEnv';
import { isWebPushSupported, subscribeWebPush } from '../pwa/webPush';

/**
 * Registers Web Push after login so background tabs can receive turn/tournament alerts
 * (WhatsApp-style: push + sync on foreground, not a forever-live WS in background).
 */
export function useWebPush(): void {
  const { user, authHydrated } = useAuthStore();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!authHydrated || !user?.id || attemptedRef.current) return;
    if (!isWebPushSupported()) return;

    const vapidKey = getRuntimeEnv('VITE_VAPID_PUBLIC_KEY');
    if (!vapidKey) return;

    attemptedRef.current = true;
    void subscribeWebPush(vapidKey).catch(() => {
      attemptedRef.current = false;
    });
  }, [authHydrated, user?.id]);
}
