import React, { useEffect } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonIcon,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { trophyOutline } from 'ionicons/icons';
import { filterCatalogTournaments } from '../../util/tournamentUtils';
import { useTournamentsStore } from '../../store/tournamentsStore';
import { useT } from '../../i18n/translations';
import TournamentCard from '../../ui/components/tournaments/TournamentCard';
import { AppBackButton } from '../../navigation/AppBackButton';

const TournamentsPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const { list, loadList, loading } = useTournamentsStore();

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const sorted = filterCatalogTournaments(list).sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <AppBackButton to="/dashboard" />
          </IonButtons>
          <IonTitle>{t('tournaments_title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent style={{ '--background': 'var(--sovereign-bg)' } as React.CSSProperties}>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void loadList().finally(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px', maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IonIcon icon={trophyOutline} style={{ color: '#1a1200', fontSize: '24px' }} />
            </div>
            <div>
              <IonText>
                <h2 style={{ margin: 0, color: 'var(--sovereign-text)', fontSize: '20px', fontWeight: 800 }}>
                  {t('tournaments_title')}
                </h2>
              </IonText>
              <IonText>
                <p style={{ margin: '2px 0 0', color: 'var(--sovereign-text-muted)', fontSize: '13px' }}>
                  {t('tournaments_subtitle')}
                </p>
              </IonText>
            </div>
          </div>

          {sorted.map((item) => (
            <TournamentCard
              key={item.id}
              tournament={item}
              onClick={() => navigate(`/tournaments/${item.id}`)}
            />
          ))}

          {!loading && sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <IonIcon
                icon={trophyOutline}
                style={{ fontSize: '56px', color: 'var(--sovereign-text-muted)', marginBottom: '12px' }}
              />
              <IonText>
                <p style={{ color: 'var(--sovereign-text-muted)', fontSize: '15px' }}>{t('tournaments_empty')}</p>
              </IonText>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TournamentsPage;
