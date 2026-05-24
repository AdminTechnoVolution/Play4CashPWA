import React, { useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonBackButton,
  IonButtons,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useTournamentsStore } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';
import { formatUSD } from '../../util/formatCurrency';
import { officialRemainingMs } from '../../store/tournamentsStore';

const TournamentsPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const { list, loadList, loading } = useTournamentsStore();

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('tournaments_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void loadList().finally(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
        <IonList>
          {list.map((item) => (
            <IonItem
              key={item.id}
              button
              detail
              onClick={() => navigate(`/tournaments/${item.id}`)}
            >
              <IonLabel>
                <h2>{item.title}</h2>
                <p>{item.gameSocketCode}</p>
                <p>
                  {t('tournament_buy_in')}: {formatUSD(item.buyIn)} ·{' '}
                  {item.registeredCount}/{item.maxPlayers}
                </p>
              </IonLabel>
              <IonNote slot="end">
                {Math.ceil(officialRemainingMs(item) / 60000)}m
              </IonNote>
            </IonItem>
          ))}
          {!loading && list.length === 0 && (
            <IonItem lines="none">
              <IonLabel>{t('tournaments_empty')}</IonLabel>
            </IonItem>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TournamentsPage;
