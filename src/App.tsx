import { useEffect } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { useAuthStore } from './store/authStore';
import { RequireAuth, RootRedirect } from './auth/RequireAuth';
import { usePWAInstallStore } from './store/pwaInstallStore';
import PWAInstallBanner from './ui/components/PWAInstallBanner';
import ActiveRoomBanner from './ui/components/ActiveRoomBanner';
import ReconnectionBanner from './ui/components/ReconnectionBanner';
import AppUpdateModal from './pwa/AppUpdateModal';
import { useVisibilityReconnect } from './hooks/useVisibilityReconnect';

import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import RoomsPage from './pages/rooms/RoomsPage';
import PlayPage from './pages/play/PlayPage';
import AddFundsPage from './pages/add-funds/AddFundsPage';
import WithdrawalPage from './pages/withdrawal/WithdrawalPage';
import WithdrawalVerifyPage from './pages/withdrawal/WithdrawalVerifyPage';
import SettingsPage from './pages/settings/SettingsPage';
import TransactionHistoryPage from './pages/history/TransactionHistoryPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import DataTreatmentPage from './pages/legal/DataTreatmentPage';
import TournamentsPage from './pages/tournaments/TournamentsPage';
import TournamentDetailPage from './pages/tournaments/TournamentDetailPage';
import TournamentBracketPage from './pages/tournaments/TournamentBracketPage';
import { tryConsumePlayBack } from './util/playBackNavigation';

setupIonicReact({ mode: 'md' });

export default function App() {
  const { loadSession } = useAuthStore();
  const setDeferredPrompt = usePWAInstallStore((s) => s.setDeferredPrompt);

  // Phase D: forces socket.io to retry connect() the moment the tab regains
  // visibility/focus so mobile users don't see stale states after backgrounding.
  useVisibilityReconnect();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as any);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [setDeferredPrompt]);

  useEffect(() => {
    const onIonBack = (ev: Event) => {
      const e = ev as CustomEvent<{ register: (priority: number, fn: () => void) => void }>;
      e.detail.register(10, () => {
        if (tryConsumePlayBack()) return;
        window.history.back();
      });
    };
    document.addEventListener('ionBackButton', onIonBack);
    return () => document.removeEventListener('ionBackButton', onIonBack);
  }, []);

  return (
    <IonApp>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/data-treatment" element={<DataTreatmentPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<TransactionHistoryPage />} />
            <Route path="/add-funds" element={<AddFundsPage />} />
            <Route path="/withdrawal" element={<WithdrawalPage />} />
            <Route path="/withdrawal-verify" element={<WithdrawalVerifyPage />} />
            <Route path="/rooms/:gameSocketCode" element={<RoomsPage />} />
            <Route path="/play/:gameSocketCode" element={<PlayPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
            <Route path="/tournaments/:tournamentId/bracket" element={<TournamentBracketPage />} />
          </Route>
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        {/* Phase C: needs useNavigate/useLocation, so it lives inside the router. */}
        <ActiveRoomBanner />
      </BrowserRouter>
      <PWAInstallBanner />
      {/* Phase D: surfaces any in-flight socket reconnect attempt globally. */}
      <ReconnectionBanner />
      <AppUpdateModal />
    </IonApp>
  );
}
