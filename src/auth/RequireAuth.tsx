import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner } from '@ionic/react';
import { useAuthStore } from '../store/authStore';

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

export function RequireAuth() {
  const { user, authHydrated, isLoading } = useAuthStore();
  const location = useLocation();

  if (!authHydrated || isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function RootRedirect() {
  const { user, authHydrated } = useAuthStore();

  if (!authHydrated) {
    return <AuthLoadingScreen />;
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}
