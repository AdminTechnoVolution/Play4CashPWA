import React, { useEffect } from 'react';
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
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useTournamentsStore } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';

const TournamentBracketPage: React.FC = () => {
  const { tournamentId = '' } = useParams();
  const t = useT();
  const { bracket, loadBracket } = useTournamentsStore();

  useEffect(() => {
    if (tournamentId) void loadBracket(tournamentId);
  }, [tournamentId, loadBracket]);

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
                <IonItem key={m.id}>
                  <IonLabel>
                    <p>{m.roundName}</p>
                    <h3>
                      {m.playerA?.username ?? '—'} vs {m.playerB?.username ?? '—'}
                    </h3>
                    <p>{m.status}</p>
                  </IonLabel>
                </IonItem>
              ))}
          </IonList>
        ))}
        <IonList>
          <IonItem lines="full">
            <IonLabel>{t('tournament_finals_phase')}</IonLabel>
          </IonItem>
          {(bracket?.finalsMatches ?? []).map((m) => (
            <IonItem key={m.id}>
              <IonLabel>
                <p>{m.roundName}</p>
                <h3>
                  {m.playerA?.username ?? '—'} vs {m.playerB?.username ?? '—'}
                </h3>
                <p>{m.status}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TournamentBracketPage;
