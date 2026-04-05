import React, { useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenu,
  IonMenuButton,
  IonButtons,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonText,
  IonRefresher,
  IonRefresherContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonSkeletonText,
  IonMenuToggle,
  IonSplitPane,
  RefresherEventDetail,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  gameControllerOutline,
  walletOutline,
  arrowDownOutline,
  timeOutline,
  settingsOutline,
  logOutOutline,
  peopleOutline,
  flashOutline,
  trophyOutline,
  cashOutline,
  playCircleOutline,
  gridOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { useDashboardStore } from '../../store/dashboardStore';
import { useAuthStore } from '../../store/authStore';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import '../../ui/theme/variables.css';

const MENU_ID = 'dashboard-menu';

const DashboardPage: React.FC = () => {
  const history = useHistory();
  const { account, games, roomStats, isLoading, error, loadDashboard, clearError } = useDashboardStore();
  const { logout } = useAuthStore();
  const contentRef = useRef<HTMLIonContentElement>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadDashboard();
    event.detail.complete();
  };

  const handleLogout = async () => {
    await logout();
    history.replace('/login');
  };

  const handleGameCard = (game: {
    id: string;
    name: string;
    minBet: number;
    socketCode: string;
  }) => {
    if (!account) return;
    history.push(
      `/rooms/${game.id}/${encodeURIComponent(game.name)}/${game.minBet}/${account.balance}/${game.socketCode}`,
    );
  };

  const navItems = [
    { icon: gridOutline, label: 'Dashboard', path: '/dashboard' },
    { icon: walletOutline, label: 'Add Funds', path: '/add-funds' },
    { icon: arrowDownOutline, label: 'Withdrawal', path: `/withdrawal/${account?.balance ?? 0}` },
    { icon: timeOutline, label: 'History', path: '/history' },
    { icon: settingsOutline, label: 'Settings', path: '/settings' },
  ];

  const SkeletonCard = () => (
    <IonCard style={{ background: 'var(--sovereign-surface)', border: '1px solid var(--sovereign-border)', borderRadius: '16px' }}>
      <IonCardContent style={{ padding: '20px' }}>
        <IonSkeletonText animated style={{ width: '60%', height: '20px', marginBottom: '12px', borderRadius: '6px' }} />
        <IonSkeletonText animated style={{ width: '40%', height: '16px', borderRadius: '6px' }} />
      </IonCardContent>
    </IonCard>
  );

  return (
    <IonSplitPane contentId={MENU_ID} when="lg">
      {/* ── Side Menu ── */}
      <IonMenu contentId={MENU_ID} type="overlay">
        <IonContent style={{ '--background': 'var(--sovereign-surface)' } as React.CSSProperties}>
          {/* Menu header */}
          <div
            style={{
              padding: '40px 24px 24px',
              borderBottom: '1px solid var(--sovereign-border)',
              background: 'var(--sovereign-bg)',
            }}
          >
            <IonText>
              <h2
                style={{
                  color: 'var(--sovereign-gold)',
                  fontSize: '22px',
                  fontWeight: '800',
                  letterSpacing: '2px',
                  margin: '0 0 4px 0',
                }}
              >
                PLAY4CASH
              </h2>
            </IonText>
            {account && (
              <>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text)', fontSize: '15px', fontWeight: '600', margin: '12px 0 2px' }}>
                    {account.username}
                  </p>
                </IonText>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: 0 }}>
                    {account.email}
                  </p>
                </IonText>
                <div
                  style={{
                    marginTop: '12px',
                    background: 'rgba(201,168,76,0.12)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    display: 'inline-block',
                  }}
                >
                  <IonText>
                    <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '16px' }}>
                      ${account.balance.toFixed(2)}
                    </span>
                  </IonText>
                </div>
              </>
            )}
          </div>

          {/* Nav items */}
          <IonList style={{ background: 'transparent', padding: '12px 0' }}>
            {navItems.map((item) => (
              <IonMenuToggle key={item.path} autoHide={false}>
                <IonItem
                  button
                  detail={false}
                  onClick={() => history.push(item.path)}
                  style={{ '--background': 'transparent', '--border-color': 'transparent', margin: '2px 12px', borderRadius: '10px' } as React.CSSProperties}
                >
                  <IonIcon icon={item.icon} slot="start" style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
                  <IonLabel style={{ color: 'var(--sovereign-text)', fontWeight: '500' }}>{item.label}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            ))}
          </IonList>

          {/* Logout */}
          <div style={{ padding: '12px', marginTop: 'auto' }}>
            <IonMenuToggle autoHide={false}>
              <IonItem
                button
                detail={false}
                onClick={handleLogout}
                style={{ '--background': 'rgba(207,102,121,0.1)', '--border-color': 'transparent', borderRadius: '10px', margin: '0 12px' } as React.CSSProperties}
              >
                <IonIcon icon={logOutOutline} slot="start" style={{ color: 'var(--sovereign-error)', fontSize: '20px' }} />
                <IonLabel style={{ color: 'var(--sovereign-error)', fontWeight: '500' }}>Logout</IonLabel>
              </IonItem>
            </IonMenuToggle>
          </div>
        </IonContent>
      </IonMenu>

      {/* ── Main Content ── */}
      <IonPage id={MENU_ID}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton style={{ color: 'var(--sovereign-gold)' }} />
            </IonButtons>
            <IonTitle style={{ color: 'var(--sovereign-gold)', fontWeight: '700', letterSpacing: '1px' }}>
              PLAY4CASH
            </IonTitle>
            {account && (
              <IonButtons slot="end">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginRight: '12px',
                    background: 'rgba(201,168,76,0.12)',
                    border: '1px solid var(--sovereign-border)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                  }}
                >
                  <IonIcon icon={cashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '16px' }} />
                  <IonText>
                    <span style={{ color: 'var(--sovereign-gold)', fontWeight: '700', fontSize: '14px' }}>
                      ${account.balance.toFixed(2)}
                    </span>
                  </IonText>
                </div>
              </IonButtons>
            )}
          </IonToolbar>
        </IonHeader>

        <IonContent ref={contentRef} style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
          <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent pullingText="Pull to refresh" refreshingSpinner="crescent" />
          </IonRefresher>

          <div style={{ padding: '20px 16px', maxWidth: '900px', margin: '0 auto' }}>

            {/* Greeting */}
            {account && (
              <div style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
                <IonText>
                  <h2 style={{ color: 'var(--sovereign-text)', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>
                    Welcome, {account.username}
                  </h2>
                </IonText>
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px', margin: 0 }}>
                    Ready to play? Choose a game below.
                  </p>
                </IonText>
              </div>
            )}

            {/* Live stats bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '28px',
                animation: 'fadeInUp 0.6s ease',
              }}
            >
              {isLoading ? (
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--sovereign-surface)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '12px',
                      padding: '14px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <IonSkeletonText animated style={{ width: '50%', height: '22px', margin: '0 auto 6px', borderRadius: '6px' }} />
                    <IonSkeletonText animated style={{ width: '70%', height: '14px', margin: '0 auto', borderRadius: '6px' }} />
                  </div>
                ))
              ) : (
                <>
                  <div
                    style={{
                      background: 'var(--sovereign-surface)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '12px',
                      padding: '14px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <IonIcon icon={peopleOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '22px', display: 'block', margin: '0 auto 4px' }} />
                    <IonText>
                      <p style={{ color: 'var(--sovereign-gold)', fontWeight: '800', fontSize: '18px', margin: '0 0 2px 0' }}>
                        {roomStats?.playersOnline ?? 0}
                      </p>
                    </IonText>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0, letterSpacing: '0.5px' }}>
                        Online
                      </p>
                    </IonText>
                  </div>

                  <div
                    style={{
                      background: 'var(--sovereign-surface)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '12px',
                      padding: '14px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <IonIcon icon={flashOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '22px', display: 'block', margin: '0 auto 4px' }} />
                    <IonText>
                      <p style={{ color: 'var(--sovereign-gold)', fontWeight: '800', fontSize: '18px', margin: '0 0 2px 0' }}>
                        {roomStats?.activeGames ?? 0}
                      </p>
                    </IonText>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0, letterSpacing: '0.5px' }}>
                        Active Games
                      </p>
                    </IonText>
                  </div>

                  <div
                    style={{
                      background: 'var(--sovereign-surface)',
                      border: '1px solid var(--sovereign-border)',
                      borderRadius: '12px',
                      padding: '14px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <IonIcon icon={trophyOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '22px', display: 'block', margin: '0 auto 4px' }} />
                    <IonText>
                      <p style={{ color: 'var(--sovereign-gold)', fontWeight: '800', fontSize: '18px', margin: '0 0 2px 0' }}>
                        ${(roomStats?.totalBet ?? 0).toFixed(0)}
                      </p>
                    </IonText>
                    <IonText>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '11px', margin: 0, letterSpacing: '0.5px' }}>
                        Total Bet
                      </p>
                    </IonText>
                  </div>
                </>
              )}
            </div>

            {/* Games section */}
            <div style={{ marginBottom: '16px', animation: 'fadeInUp 0.7s ease' }}>
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontSize: '17px', fontWeight: '700', margin: '0 0 4px 0' }}>
                  Choose a Game
                </h3>
              </IonText>
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: 0 }}>
                  Tap any game to enter the lobby
                </p>
              </IonText>
            </div>

            {isLoading ? (
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  {[0, 1, 2, 3].map((i) => (
                    <IonCol key={i} size="6" sizeMd="4" sizeLg="3">
                      <SkeletonCard />
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            ) : (
              <IonGrid style={{ padding: 0, animation: 'fadeInUp 0.8s ease' }}>
                <IonRow>
                  {games.map((game) => (
                    <IonCol key={game.id} size="6" sizeMd="4" sizeLg="3">
                      <IonCard
                        button
                        onClick={() => handleGameCard(game)}
                        style={{
                          background: 'var(--sovereign-surface)',
                          border: '1px solid var(--sovereign-border)',
                          borderRadius: '16px',
                          margin: '6px',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <IonCardContent style={{ padding: '20px 16px' }}>
                          {/* Game icon */}
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              background: 'rgba(201,168,76,0.15)',
                              border: '1px solid var(--sovereign-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '14px',
                            }}
                          >
                            <IonIcon
                              icon={gameControllerOutline}
                              style={{ color: 'var(--sovereign-gold)', fontSize: '26px' }}
                            />
                          </div>

                          <IonText>
                            <h4
                              style={{
                                color: 'var(--sovereign-text)',
                                fontSize: '15px',
                                fontWeight: '700',
                                margin: '0 0 6px 0',
                                lineHeight: '1.3',
                              }}
                            >
                              {game.name}
                            </h4>
                          </IonText>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div
                              style={{
                                background: 'rgba(201,168,76,0.12)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                              }}
                            >
                              <IonText>
                                <span style={{ color: 'var(--sovereign-gold)', fontSize: '12px', fontWeight: '600' }}>
                                  Min ${game.minBet}
                                </span>
                              </IonText>
                            </div>
                            <IonIcon
                              icon={playCircleOutline}
                              style={{ color: 'var(--sovereign-gold)', fontSize: '22px' }}
                            />
                          </div>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            )}

            {!isLoading && games.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                }}
              >
                <IonIcon
                  icon={gameControllerOutline}
                  style={{ fontSize: '64px', color: 'var(--sovereign-text-muted)', display: 'block', margin: '0 auto 16px' }}
                />
                <IonText>
                  <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '15px' }}>
                    No games available right now.
                  </p>
                </IonText>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ marginTop: '32px', animation: 'fadeInUp 0.9s ease' }}>
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontSize: '17px', fontWeight: '700', margin: '0 0 14px 0' }}>
                  Quick Actions
                </h3>
              </IonText>
              <IonList style={{ background: 'transparent', padding: 0 }}>
                {[
                  { icon: walletOutline, label: 'Add Funds', sub: 'Recharge your balance', path: '/add-funds' },
                  { icon: arrowDownOutline, label: 'Withdrawal', sub: 'Withdraw earnings', path: `/withdrawal/${account?.balance ?? 0}` },
                  { icon: timeOutline, label: 'History', sub: 'View transactions & games', path: '/history' },
                  { icon: settingsOutline, label: 'Settings', sub: 'Wallet & preferences', path: '/settings' },
                ].map((item) => (
                  <IonItem
                    key={item.path}
                    button
                    detail={false}
                    onClick={() => history.push(item.path)}
                    style={{
                      '--background': 'var(--sovereign-surface)',
                      '--background-hover': 'var(--sovereign-surface-high)',
                      '--border-color': 'var(--sovereign-border)',
                      '--inner-border-width': '0',
                      '--border-radius': '12px',
                      marginBottom: '8px',
                      borderRadius: '12px',
                      border: '1px solid var(--sovereign-border)',
                    } as React.CSSProperties}
                  >
                    <div
                      slot="start"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(201,168,76,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <IonIcon icon={item.icon} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
                    </div>
                    <IonLabel>
                      <h3 style={{ color: 'var(--sovereign-text)', fontWeight: '600', fontSize: '15px' }}>{item.label}</h3>
                      <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>{item.sub}</p>
                    </IonLabel>
                    <IonIcon icon={chevronForwardOutline} slot="end" style={{ color: 'var(--sovereign-text-muted)', fontSize: '18px' }} />
                  </IonItem>
                ))}
              </IonList>
            </div>

            <div style={{ height: '40px' }} />
          </div>
        </IonContent>

        <GenericErrorModal isOpen={!!error} message={error ?? ''} onDismiss={clearError} />
      </IonPage>
    </IonSplitPane>
  );
};

export default DashboardPage;
