import React, { useEffect, useMemo, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  checkmarkCircleOutline,
  gitNetworkOutline,
  removeCircleOutline,
} from 'ionicons/icons';
import { useTournamentsStore, officialRemainingMs } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';
import { savePlayContext } from '../../util/routingStorage';
import { useAuthStore } from '../../store/authStore';
import TournamentCard from '../../ui/components/tournaments/TournamentCard';
import TournamentMatchJoinPanel from '../../ui/components/tournaments/TournamentMatchJoinPanel';
import { SovereignPrimaryButton } from '../../ui/components/SovereignButton';
import {
  canRegisterForTournament,
  formatTournamentCountdown,
  isLiveTournamentStatus,
  isTournamentMatchReady,
  isUserEliminatedFromTournament,
  isUserRegistered,
  resolveJoinRoomId,
  shouldFocusTournamentMatch,
  tournamentStatusKey,
} from '../../util/tournamentUtils';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const {
    detail,
    bracket,
    clockTick,
    bumpClock,
    loadDetail,
    loadBracket,
    register,
    unregister,
  } = useTournamentsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!tournamentId) return;
    void loadDetail(tournamentId);
    void loadBracket(tournamentId);
    const poll = setInterval(() => {
      void loadDetail(tournamentId);
      void loadBracket(tournamentId);
    }, 5_000);
    return () => clearInterval(poll);
  }, [tournamentId, loadDetail, loadBracket]);

  useEffect(() => {
    const timer = setInterval(() => bumpClock(), 1000);
    return () => clearInterval(timer);
  }, [bumpClock]);

  void clockTick;
  const remainingLabel = useMemo(() => {
    if (!detail) return '';
    return formatTournamentCountdown(officialRemainingMs(detail));
  }, [detail, clockTick]);

  const [actionPending, setActionPending] = useState(false);

  const joinRoomId = useMemo(
    () => resolveJoinRoomId(detail, bracket, user?.id),
    [detail, bracket, user?.id],
  );

  const registered = isUserRegistered(detail);
  const canRegister = detail ? canRegisterForTournament(detail) : false;
  const canUnregister =
    registered && detail && ['open', 'full', 'countdown'].includes(detail.status);
  const live = detail ? isLiveTournamentStatus(detail.status) : false;
  const eliminated = detail ? isUserEliminatedFromTournament(detail) : false;
  const matchReady = detail ? isTournamentMatchReady(detail, joinRoomId) : false;
  const focusMatch = detail ? shouldFocusTournamentMatch(detail, joinRoomId) : false;

  const onRegister = async () => {
    setActionPending(true);
    try {
      await register(tournamentId);
    } finally {
      setActionPending(false);
    }
  };

  const onUnregister = async () => {
    setActionPending(true);
    try {
      await unregister(tournamentId);
    } finally {
      setActionPending(false);
    }
  };

  const goToMatch = () => {
    if (!detail || !joinRoomId) return;
    savePlayContext({
      roomId: joinRoomId,
      betAmount: 0,
      roomName: detail.title,
      opponentName: detail.myActiveMatch?.opponentUsername ?? '',
      hasOpponent: true,
      isPlayer1: true,
      isSpectator: false,
    });
    navigate(`/play/${detail.gameSocketCode}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tournaments" />
          </IonButtons>
          <IonTitle>{detail?.title ?? t('tournaments_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent
        style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}
        className="ion-padding"
      >
        <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '120px' }}>
          {detail && (
            <>
              {matchReady ? (
                <>
                  <TournamentMatchJoinPanel
                    tournament={detail}
                    myMatch={detail.myActiveMatch}
                    roomId={joinRoomId}
                    onJoin={goToMatch}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    <IonButton
                      expand="block"
                      fill="outline"
                      onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}
                    >
                      <IonIcon icon={gitNetworkOutline} slot="start" />
                      {t('tournament_view_bracket')}
                    </IonButton>
                  </div>
                </>
              ) : (
                <>
              <TournamentCard tournament={detail} showRegisteredBadge={false} />

              {eliminated && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: 'rgba(244,67,54,0.1)',
                    border: '1px solid rgba(244,67,54,0.35)',
                  }}
                >
                  <p style={{ margin: 0, color: '#ef9a9a', fontWeight: 800, fontSize: '14px' }}>
                    {t('tournament_eliminated_title')}
                  </p>
                  <p style={{ margin: '8px 0 0', color: 'var(--sovereign-text-muted)', fontSize: '13px', lineHeight: 1.45 }}>
                    {t('tournament_eliminated_watch_hint')}
                  </p>
                </div>
              )}

              {registered && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'rgba(76,175,80,0.12)',
                    border: '1px solid rgba(76,175,80,0.35)',
                  }}
                >
                  <IonIcon icon={checkmarkCircleOutline} style={{ color: '#81c784', fontSize: '24px' }} />
                  <div>
                    <p style={{ margin: 0, color: '#a5d6a7', fontWeight: 800, fontSize: '14px' }}>
                      {t('tournament_registered_message')}
                    </p>
                    {detail.myRegistration?.groupNumber != null && (
                      <p style={{ margin: '2px 0 0', color: 'var(--sovereign-text-muted)', fontSize: '12px' }}>
                        {t('tournament_your_group').replace('{{n}}', String(detail.myRegistration.groupNumber))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {registered && live && focusMatch && (
                <TournamentMatchJoinPanel
                  tournament={detail}
                  myMatch={detail.myActiveMatch}
                  roomId={joinRoomId}
                  onJoin={goToMatch}
                />
              )}

              {!focusMatch && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px',
                  marginBottom: '16px',
                  borderRadius: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--sovereign-border)',
                }}
              >
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--sovereign-text-muted)', fontWeight: 600 }}>
                  {live ? t('tournament_floater_live') : t('tournament_countdown')}
                </p>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '36px',
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                    color: live ? '#4caf50' : 'var(--sovereign-gold)',
                    letterSpacing: '1px',
                  }}
                >
                  {remainingLabel}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--sovereign-text-muted)' }}>
                  {t(tournamentStatusKey(detail.status))}
                </p>
                {detail.pauseRemainingMs != null && detail.pauseRemainingMs > 0 && (
                  <p style={{ margin: '8px 0 0', color: '#ffb74d', fontSize: '13px', fontWeight: 700 }}>
                    {t('tournament_pause')}: {Math.ceil(detail.pauseRemainingMs / 1000)}s
                  </p>
                )}
              </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {canRegister && (
                  <SovereignPrimaryButton expand="block" onClick={() => void onRegister()} disabled={actionPending}>
                    {t('tournament_register')}
                  </SovereignPrimaryButton>
                )}

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}
                >
                  <IonIcon icon={gitNetworkOutline} slot="start" />
                  {t('tournament_view_bracket')}
                </IonButton>

                {canUnregister && (
                  <IonButton
                    expand="block"
                    color="medium"
                    fill="clear"
                    onClick={() => void onUnregister()}
                    disabled={actionPending}
                  >
                    <IonIcon icon={removeCircleOutline} slot="start" />
                    {t('tournament_unregister')}
                  </IonButton>
                )}
              </div>
                </>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TournamentDetailPage;
