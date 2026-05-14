import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useAuthStore } from '../store/authStore';
import { hasValidSession } from '../data/auth/AuthSessionStore';

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
  const { user, authHydrated, isLoading } = useAuthStore();
  const location = useLocation();

  if (!authHydrated || isLoading) {
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
