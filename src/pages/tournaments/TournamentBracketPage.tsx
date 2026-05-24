import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonToast,
} from '@ionic/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournamentsStore } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';
import { apiRepository } from '../../data/network/ApiRepository';
import { savePlayContext } from '../../util/routingStorage';
import { canSpectateTournamentMatch } from '../../util/tournamentUtils';
import { formatApiMessageForDisplay } from '../../i18n/ApiMessageDisplay';

type BracketMatch = {
  id: string;
  groupNumber?: number | null;
  roundName: string;
  status: string;
  playerA: { userId: string; username: string } | null;
  playerB: { userId: string; username: string } | null;
  winnerUserId: string | null;
  roomId: string | null;
};

function MatchRow({
  match,
  onSpectate,
  spectatingId,
  t,
}: {
  match: BracketMatch;
  onSpectate: (m: BracketMatch) => void;
  spectatingId: string | null;
  t: (key: string) => string;
}) {
  const canWatch = canSpectateTournamentMatch(match.status, match.roomId);
  return (
    <IonItem key={match.id}>
      <IonLabel>
        <p>{match.roundName.replace(/_/g, ' ')}</p>
        <h3>
          {match.playerA?.username ?? '—'} vs {match.playerB?.username ?? '—'}
        </h3>
        <p>{match.status}</p>
      </IonLabel>
      {canWatch && match.roomId && (
        <IonButton
          slot="end"
          fill="outline"
          size="small"
          disabled={spectatingId === match.roomId}
          onClick={() => onSpectate(match)}
        >
          {t('tournament_spectate_match')}
        </IonButton>
      )}
    </IonItem>
  );
}

const TournamentBracketPage: React.FC = () => {
  const { tournamentId = '' } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const { bracket, detail, loadBracket, loadDetail } = useTournamentsStore();
  const [spectatingId, setSpectatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    void loadBracket(tournamentId);
    void loadDetail(tournamentId);
    const poll = setInterval(() => void loadBracket(tournamentId), 12_000);
    return () => clearInterval(poll);
  }, [tournamentId, loadBracket, loadDetail]);

  const gameSocketCode = detail?.gameSocketCode ?? '';
  const tournamentTitle = detail?.title ?? t('tournaments_title');

  const handleSpectate = async (match: BracketMatch) => {
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
          <IonTitle>{t('tournament_bracket_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {[1, 2, 3, 4, 5].map((g) => (
          <IonList key={g}>
            <IonItem lines="full">
              <IonLabel>{t('tournament_group_n').replace('%d', String(g))}</IonLabel>
            </IonItem>
            {(bracket?.groupMatches ?? [])
              .filter((m) => m.groupNumber === g)
              .map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  onSpectate={handleSpectate}
                  spectatingId={spectatingId}
                  t={t}
                />
              ))}
          </IonList>
        ))}
        <IonList>
          <IonItem lines="full">
            <IonLabel>{t('tournament_finals_phase')}</IonLabel>
          </IonItem>
          {(bracket?.finalsMatches ?? []).map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              onSpectate={handleSpectate}
              spectatingId={spectatingId}
              t={t}
            />
          ))}
        </IonList>
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
