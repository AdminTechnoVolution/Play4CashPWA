import { useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';

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

setupIonicReact({ mode: 'md' });

export default function App() {
  const { user, loadSession } = useAuthStore();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/login" component={LoginPage} />
          <Route exact path="/dashboard" component={DashboardPage} />
          <Route exact path="/settings" component={SettingsPage} />
          <Route exact path="/history" component={TransactionHistoryPage} />
          <Route exact path="/add-funds" component={AddFundsPage} />
          <Route exact path="/withdrawal/:userBalance" component={WithdrawalPage} />
          <Route exact path="/withdrawal-verify" component={WithdrawalVerifyPage} />
          <Route
            exact
            path="/rooms/:gameId/:gameName/:minBet/:userBalance/:gameSocketCode"
            component={RoomsPage}
          />
          <Route
            exact
            path="/play/:gameSocketCode/:roomId/:betAmount/:roomName/:opponentName/:hasOpponent/:isSpectator"
            component={PlayPage}
          />
          <Route exact path="/">
            <Redirect to={user ? '/dashboard' : '/login'} />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
