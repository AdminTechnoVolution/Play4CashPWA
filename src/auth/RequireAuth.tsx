import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useAuthStore } from '../store/authStore';
import { hasValidSession } from '../data/auth/AuthSessionStore';
import { refreshAccessTokenWithLock } from '../data/network/ApiClient';

function AuthLoadingScreen() {
  return (
    <IonPage>
      <IonContent
        fullscreen
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IonSpinner name="crescent" />
      </IonContent>
    </IonPage>
  );
}

/**
 * Layout route: waits for initial session resolution, then requires a logged-in user.
 */
export function RequireAuth() {
  const { user, authHydrated, isLoading, loadSession } = useAuthStore();
  const location = useLocation();
  const [sessionRefreshDone, setSessionRefreshDone] = useState(false);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);

  const needsTokenRefresh = !!user && !hasValidSession();

  useEffect(() => {
    if (!authHydrated || isLoading || sessionRefreshDone || !needsTokenRefresh) return;

    setSessionRefreshing(true);
    void (async () => {
      try {
        await refreshAccessTokenWithLock();
        await loadSession();
      } catch {
        // loadSession / auth-failure listener will clear state if refresh is dead
      } finally {
        setSessionRefreshing(false);
        setSessionRefreshDone(true);
      }
    })();
  }, [authHydrated, isLoading, sessionRefreshDone, needsTokenRefresh, loadSession]);

  if (!authHydrated || isLoading || (needsTokenRefresh && !sessionRefreshDone)) {
    return <AuthLoadingScreen />;
  }

  if (sessionRefreshing) {
    return <AuthLoadingScreen />;
  }

  // Defense-in-depth: a stale `user` in the store (e.g. cached account from a previous
  // session) must not unlock protected routes. Require both an account AND a live
  // access token. `hasValidSession()` checks the in-memory token's `exp` claim.
  if (!user || !hasValidSession()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Home and unknown paths: send to dashboard or login after hydration. */
export function RootRedirect() {
  const { user, authHydrated } = useAuthStore();

  if (!authHydrated) {
    return <AuthLoadingScreen />;
  }

  const authed = !!user && hasValidSession();
  return <Navigate to={authed ? '/dashboard' : '/login'} replace />;
}
