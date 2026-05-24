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
  IonText,
  IonCard,
  IonCardContent,
} from '@ionic/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentsStore, officialRemainingMs } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';
import { formatUSD } from '../../util/formatCurrency';
import { savePlayContext } from '../../util/routingStorage';
import { useAuthStore } from '../../store/authStore';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const {
    detail,
    bracket,
    loadDetail,
    loadBracket,
    register,
    unregister,
    connectSocket,
    disconnectSocket,
  } = useTournamentsStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!tournamentId) return;
    void loadDetail(tournamentId);
    void loadBracket(tournamentId);
    connectSocket(tournamentId);
    return () => disconnectSocket();
  }, [tournamentId, loadDetail, loadBracket, connectSocket, disconnectSocket]);

  const remainingLabel = useMemo(() => {
    if (!detail) return '';
    const ms = officialRemainingMs(detail);
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [detail]);

  const [actionPending, setActionPending] = useState(false);

  const myMatchRoomId = useMemo(() => {
    const uid = user?.id;
    if (!uid || !bracket) return null;
    const all = [...bracket.groupMatches, ...bracket.finalsMatches];
    const mine = all.find(
      (m) =>
        (m.playerA?.userId === uid || m.playerB?.userId === uid) &&
        m.roomId &&
        ['ready', 'started', 'waiting_presence'].includes(m.status),
    );
    return mine?.roomId ?? null;
  }, [bracket, user?.id]);

  const registered = !!detail?.myRegistration;

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
    if (!detail || !myMatchRoomId) return;
    savePlayContext({
      roomId: myMatchRoomId,
      betAmount: 0,
      roomName: detail.title,
      opponentName: '',
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
      <IonContent className="ion-padding">
        {detail && (
          <IonCard>
            <IonCardContent>
              <IonText>
                <h2>{detail.title}</h2>
                <p>{detail.description}</p>
                <p>{t('tournament_status')}: {detail.status}</p>
                <p>{t('tournament_buy_in')}: {formatUSD(detail.buyIn)}</p>
                <p>
                  {t('tournament_slots')}: {detail.registeredCount}/{detail.maxPlayers}
                </p>
                <p>{t('tournament_turn_timer')}: {detail.turnTimerSeconds}s</p>
                <p>{t('tournament_countdown')}: {remainingLabel}</p>
                {detail.pauseRemainingMs != null && detail.pauseRemainingMs > 0 && (
                  <p>{t('tournament_pause')}: {Math.ceil(detail.pauseRemainingMs / 1000)}s</p>
                )}
                <p>{t('tournament_prize_pool')}: {formatUSD(detail.grossPrizePool)}</p>
              </IonText>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {!registered && (detail.status === 'open' || detail.status === 'full') && (
                  <IonButton onClick={() => void onRegister()} disabled={actionPending}>
                    {t('tournament_register')}
                  </IonButton>
                )}
                {registered && ['open', 'full', 'countdown'].includes(detail.status) && (
                  <IonButton color="medium" onClick={() => void onUnregister()} disabled={actionPending}>
                    {t('tournament_unregister')}
                  </IonButton>
                )}
                <IonButton fill="outline" onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}>
                  {t('tournament_view_bracket')}
                </IonButton>
                {myMatchRoomId && (
                  <IonButton onClick={goToMatch}>{t('tournament_go_to_match')}</IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TournamentDetailPage;
