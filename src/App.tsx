import { useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';

import { useAuthStore } from './store/authStore';

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

setupIonicReact({ mode: 'md' });

export default function App() {
  const { user, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <IonApp>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/history" element={<TransactionHistoryPage />} />
          <Route path="/add-funds" element={<AddFundsPage />} />
          <Route path="/withdrawal" element={<WithdrawalPage />} />
          <Route path="/withdrawal-verify" element={<WithdrawalVerifyPage />} />
          <Route
            path="/rooms/:gameId/:gameName/:gameSocketCode"
            element={<RoomsPage />}
          />
          <Route
            path="/play/:gameSocketCode/:roomId/:betAmount/:roomName/:opponentName/:hasOpponent/:isSpectator"
            element={<PlayPage />}
          />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/data-treatment" element={<DataTreatmentPage />} />
          <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </IonApp>
  );
}
