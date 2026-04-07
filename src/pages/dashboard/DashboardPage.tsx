import React, { useEffect, useRef, useState } from 'react';
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
  IonModal,
  IonButton,
  RefresherEventDetail,
} from '@ionic/react';
import { useNavigate } from "react-router-dom";
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
  informationCircleOutline,
} from 'ionicons/icons';
import { useDashboardStore } from '../../store/dashboardStore';
import { useAuthStore } from '../../store/authStore';
import GenericErrorModal from '../../ui/components/GenericErrorModal';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import { useT } from '../../i18n/translations';
import '../../ui/theme/variables.css';

const MENU_ID = 'dashboard-menu';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { account, games, roomStats, isLoading, error, loadDashboard, clearError } = useDashboardStore();
  const { logout } = useAuthStore();
  const contentRef = useRef<HTMLIonContentElement>(null);
  const t = useT();

  // Modal states
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any>(null);

  useEffect(() => {
    loadDashboard();
    // Live stats refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboard();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await loadDashboard();
    event.detail.complete();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleGameCard = (game: { id: string; name: string; socketCode: string }) => {
    navigate(`/rooms/${game.id}/${encodeURIComponent(game.name)}/${game.socketCode}`);
  };

  const navItems = [
    { icon: gridOutline, label: 'Dashboard', path: '/dashboard' },
    { icon: walletOutline, label: t('add_funds_title'), path: '/add-funds' },
    { icon: arrowDownOutline, label: t('withdrawal_title'), path: '/withdrawal' },
    { icon: timeOutline, label: t('game_history_title'), path: '/history' },
    { icon: settingsOutline, label: t('settings_title'), path: '/settings' },
  ];

  const SkeletonCard = () => (
    <IonCard style={{ background: 'var(--sovereign-surface)', border: '1px solid var(--sovereign-border)', borderRadius: '16px' }}>
      <IonCardContent style={{ padding: '20px' }}>
        <IonSkeletonText animated style={{ width: '60%', height: '20px', marginBottom: '12px', borderRadius: '6px' }} />
        <IonSkeletonText animated style={{ width: '40%', height: '16px', borderRadius: '6px' }} />
      </IonCardContent>
    </IonCard>
  );

  const GameCardCompact: React.FC<{ game: any }> = ({ game }) => {
    const playerRange = game.minPlayers === game.maxPlayers ? `${game.minPlayers}` : `${game.minPlayers}-${game.maxPlayers}`;

    return (
      <IonCard
        style={{
          background: 'var(--sovereign-surface)',
          border: '1px solid var(--sovereign-border)',
          borderRadius: '16px',
          margin: '6px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background Image */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.38,
          zIndex: 0,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <img
            src={`/${game.socketCode.includes('naval') ? 'battleship' : game.socketCode}/bg_${game.socketCode.includes('naval') ? 'battleship' : game.socketCode}_home_card.png`}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>

        <IonCardContent style={{ padding: '16px', position: 'relative', zIndex: 1 }}>
          {/* Header Icons */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', marginBottom: '12px' }}>
            {/* Center: Gamepad */}
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              }}
            >
              <IonIcon icon={gameControllerOutline} style={{ color: '#000', fontSize: '24px' }} />
            </div>

            {/* Right: Info button for video */}
            <div
              onClick={(e) => { e.stopPropagation(); setSelectedGame(game); setShowVideoModal(true); }}
              style={{ padding: '4px', cursor: 'pointer', position: 'absolute', right: '-4px', top: '-4px' }}
            >
              <IonIcon icon={informationCircleOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '22px' }} />
            </div>
          </div>

          {/* Game Identification */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <IonText>
              <h4 style={{ color: 'var(--sovereign-text)', fontSize: '15px', fontWeight: '700', margin: '0 0 4px 0', lineHeight: '1.2' }}>
                {game.name}
              </h4>
            </IonText>
            <IonText>
              <p style={{
                color: 'var(--sovereign-text-muted)',
                fontSize: '12px',
                margin: '0 0 6px 0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.3'
              }}>
                {game.description || t('dashboard_no_games_subtitle')}
              </p>
            </IonText>
            <IonText
              style={{ color: 'var(--sovereign-gold)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={(e) => { e.stopPropagation(); setSelectedGame(game); setShowRulesModal(true); }}
            >
              {t('game_read_full_description')}
            </IonText>
          </div>

          {/* Stats Column (Bottom Left Style) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IonIcon icon={peopleOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px' }} />
              <span style={{ color: 'var(--sovereign-text)', fontSize: '12px', fontWeight: '600' }}>{playerRange}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IonText style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px', fontWeight: '700', width: '14px', textAlign: 'center' }}>$</IonText>
              <span style={{ color: 'var(--sovereign-text)', fontSize: '12px', fontWeight: '600' }}>${game.minBet}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IonIcon icon={timeOutline} style={{ color: 'var(--sovereign-text-muted)', fontSize: '14px' }} />
              <span style={{ color: 'var(--sovereign-text-muted)', fontSize: '12px' }}>{game.turnTimerSeconds}s</span>
            </div>
          </div>

          {/* Action Button */}
          <SovereignPrimaryButton
            expand="block"
            onClick={() => handleGameCard(game)}
            style={{ '--padding-top': '8px', '--padding-bottom': '8px', height: '36px' } as React.CSSProperties}
          >
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{t('see_rooms')}</span>
          </SovereignPrimaryButton>
        </IonCardContent>
      </IonCard>
    );
  };

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
                  onClick={() => navigate(item.path)}
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
                <IonLabel style={{ color: 'var(--sovereign-error)', fontWeight: '500' }}>{t('log_out')}</IonLabel>
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

        <IonContent ref={contentRef} style={{ '--background': 'transparent' } as React.CSSProperties}>
          <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent pullingText="Pull to refresh" refreshingSpinner="crescent" />
          </IonRefresher>

          <div style={{ padding: '20px 16px', maxWidth: '900px', margin: '0 auto' }}>

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
                        {t('dashboard_stat_players_online')}
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
                        {t('dashboard_stat_active_games')}
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
                        {t('dashboard_stat_money_in_play')}
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
                  {t('dashboard_games')}
                </h3>
              </IonText>
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '13px', margin: 0 }}>
                  {t('dashboard_no_games_subtitle')}
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
                <IonRow style={{ margin: '-6px' }}>
                  {games.map((game) => (
                    <IonCol key={game.id} size="6" sizeMd="4" sizeLg="3" style={{ padding: 0 }}>
                      <GameCardCompact game={game} />
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
                    {t('dashboard_no_games_title')}
                  </p>
                </IonText>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ marginTop: '32px', animation: 'fadeInUp 0.9s ease' }}>
              <IonText>
                <h3 style={{ color: 'var(--sovereign-text)', fontSize: '17px', fontWeight: '700', margin: '0 0 14px 0' }}>
                  {t('dashboard_quick_actions')}
                </h3>
              </IonText>
              <IonList style={{ background: 'transparent', padding: 0 }}>
                {[
                  { icon: walletOutline, label: t('dashboard_item_add_funds'), sub: t('dashboard_item_add_funds_subtitle'), path: '/add-funds' },
                  { icon: arrowDownOutline, label: t('dashboard_item_withdrawal'), sub: t('dashboard_item_withdrawal_subtitle'), path: '/withdrawal' },
                  { icon: timeOutline, label: t('history_hub_title'), sub: t('history_hub_title'), path: '/history' },
                  { icon: settingsOutline, label: t('settings_title'), sub: t('settings_title'), path: '/settings' },
                ].map((item) => (
                  <IonItem
                    key={item.path}
                    button
                    detail={false}
                    onClick={() => navigate(item.path)}
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

        {/* Video Modal */}
        <IonModal
          isOpen={showVideoModal}
          onDidDismiss={() => setShowVideoModal(false)}
          className="sovereign-modal"
          style={{ '--height': 'auto', '--border-radius': '20px' }}
        >
          <div style={{ padding: '20px', background: 'var(--sovereign-surface)', color: 'var(--sovereign-text)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>{selectedGame?.name}</h2>
              <IonIcon
                icon={chevronForwardOutline}
                style={{ fontSize: '24px', cursor: 'pointer', transform: 'rotate(90deg)' }}
                onClick={() => setShowVideoModal(false)}
              />
            </div>
            <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedGame && (
                <video
                  controls
                  autoPlay
                  style={{ width: '100%', display: 'block' }}
                  src={`/assets/videos/${selectedGame.socketCode.includes('naval') ? 'battleship' : selectedGame.socketCode}.mp4`}
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </IonModal>

        {/* Rules/Description Modal */}
        <IonModal
          isOpen={showRulesModal}
          onDidDismiss={() => setShowRulesModal(false)}
          style={{ '--height': '80%', '--border-radius': '20.dp' } as any}
        >
          <div style={{ padding: '24px', background: 'var(--sovereign-surface)', color: 'var(--sovereign-text)', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--sovereign-gold)', marginBottom: '16px' }}>
              {selectedGame?.name}
            </h2>
            <div style={{ lineHeight: '1.6', fontSize: '15px' }}>
              {selectedGame?.description || t('dashboard_no_games_subtitle')}

              {selectedGame?.defaultBets?.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--sovereign-gold)', marginBottom: '8px' }}>
                    {t('game_suggested_bets')}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedGame.defaultBets.map((bet: number) => (
                      <span key={bet} style={{ background: 'rgba(201,168,76,0.15)', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', color: 'var(--sovereign-gold)' }}>
                        ${bet}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <SovereignPrimaryButton expand="block" onClick={() => setShowRulesModal(false)} style={{ marginTop: '32px' }}>
              {t('ok')}
            </SovereignPrimaryButton>
          </div>
        </IonModal>
      </IonPage>
    </IonSplitPane>
  );
};

export default DashboardPage;
