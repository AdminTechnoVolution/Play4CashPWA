import React, { useEffect, useMemo, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonToast,
} from '@ionic/react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTournamentsStore } from '../../store/tournamentsStore';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../i18n/translations';
import { apiRepository } from '../../data/network/ApiRepository';
import { savePlayContext } from '../../util/routingStorage';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';
import { isLiveTournamentStatus } from '../../util/tournamentUtils';
import type { TournamentBracketMatch, TournamentHistoryItem, TournamentSummary } from '../../data/models/ApiModels';
import TournamentBracketView from '../../ui/components/tournaments/TournamentBracketView';

const TournamentBracketPage: React.FC = () => {
  const { tournamentId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id);
  const detail = useTournamentsStore((s) => s.detail);
  const detailsById = useTournamentsStore((s) => s.detailsById);
  const bracket = useTournamentsStore(
    (s) => s.bracketsById[tournamentId] ?? (s.detail?.id === tournamentId ? s.bracket : null),
  );
  const loadBracket = useTournamentsStore((s) => s.loadBracket);
  const loadDetail = useTournamentsStore((s) => s.loadDetail);
  const connectSocket = useTournamentsStore((s) => s.connectSocket);

  const [bracketLoading, setBracketLoading] = useState(true);
  const [bracketError, setBracketError] = useState(false);
  const [spectatingId, setSpectatingId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const historyFallback = (location.state as { tournament?: TournamentHistoryItem } | null)?.tournament;
  const tournament: TournamentSummary | null =
    detail?.id === tournamentId
      ? detail
      : detailsById[tournamentId] ??
        (historyFallback?.id === tournamentId
          ? {
              id: historyFallback.id,
              title: historyFallback.title,
              description: '',
              gameSocketCode: historyFallback.gameSocketCode,
              status: historyFallback.status,
              buyIn: historyFallback.buyIn,
              maxPlayers: historyFallback.maxPlayers,
              registeredCount: historyFallback.registeredCount,
              startsAt: historyFallback.startedAt,
              serverNow: new Date().toISOString(),
              remainingMs: 0,
              pauseRemainingMs: null,
              turnTimerSeconds: 30,
              grossPrizePool: historyFallback.grossPrizePool,
              houseFeePercent: historyFallback.houseFeePercent,
              firstPlacePercent: historyFallback.firstPlacePercent,
              firstPlaceAmount: historyFallback.firstPlaceAmount,
              secondPlaceAmount: historyFallback.secondPlaceAmount,
              myRegistration: null,
              myActiveMatch: null,
            }
          : null);

  const pollMs = useMemo(() => {
    if (tournament && isLiveTournamentStatus(tournament.status)) return 5000;
    if (tournament && ['open', 'full', 'countdown'].includes(tournament.status)) return 5000;
    return 15000;
  }, [tournament?.status]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;

    const refresh = async () => {
      setBracketError(false);
      const [, bracketResult] = await Promise.all([
        loadDetail(tournamentId),
        loadBracket(tournamentId),
      ]);
      if (!cancelled) {
        setBracketLoading(false);
        setBracketError(bracketResult == null);
      }
    };

    void refresh();
    const poll = setInterval(() => void loadBracket(tournamentId), pollMs);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [tournamentId, loadBracket, loadDetail, pollMs]);

  useEffect(() => {
    if (!tournamentId || !tournament) return;
    if (isLiveTournamentStatus(tournament.status)) {
      connectSocket(tournamentId);
    }
  }, [tournamentId, tournament?.status, connectSocket, tournament]);

  const gameSocketCode = tournament?.gameSocketCode ?? '';
  const tournamentTitle = tournament?.title ?? t('tournaments_title');

  const handleJoinMatch = (match: TournamentBracketMatch, roomId: string) => {
    if (!gameSocketCode) return;
    setJoiningId(roomId);
    savePlayContext({
      roomId,
      betAmount: 0,
      roomName: tournamentTitle,
      opponentName:
        match.playerA?.userId === userId
          ? (match.playerB?.username ?? '')
          : (match.playerA?.username ?? ''),
      hasOpponent: true,
      isPlayer1: true,
      isSpectator: false,
    });
    navigate(`/play/${gameSocketCode}`);
    setJoiningId(null);
  };

  const handleSpectate = async (match: TournamentBracketMatch) => {
    if (!match.roomId || !gameSocketCode) return;
    setSpectatingId(match.roomId);
    try {
      await apiRepository.spectateRoom(match.roomId);
      savePlayContext({
        roomId: match.roomId,
        betAmount: 0,
        roomName: tournamentTitle,
        opponentName: match.playerA?.username ?? '',
        hasOpponent: true,
        isSpectator: true,
        isPlayer1: false,
      });
      navigate(`/play/${gameSocketCode}`);
    } catch (err) {
      setToast(formatApiMessageForDisplay(err instanceof Error ? err.message : null, 'error_spectate_room'));
    } finally {
      setSpectatingId(null);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/tournaments/${tournamentId}`} />
          </IonButtons>
          <IonTitle>{tournamentTitle}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
        <TournamentBracketView
          bracket={bracket}
          tournament={tournament}
          userId={userId}
          loading={bracketLoading}
          loadFailed={bracketError && !bracket}
          onJoinMatch={handleJoinMatch}
          onSpectate={handleSpectate}
          joiningRoomId={joiningId}
          spectatingRoomId={spectatingId}
        />
      </IonContent>
      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
};

export default TournamentBracketPage;
