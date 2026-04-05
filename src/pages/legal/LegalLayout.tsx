import { useNavigate } from 'react-router-dom';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle, IonContent, IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import '../../ui/theme/variables.css';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function LegalLayout({ title, children }: Props) {
  const navigate = useNavigate();

  return (
    <IonPage style={{ '--background': '#0a1628' } as React.CSSProperties}>
      <IonHeader>
        <IonToolbar style={{ '--background': '#0a1628', '--border-color': 'rgba(201,168,76,0.2)' } as React.CSSProperties}>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate(-1)}>
              <IonIcon icon={arrowBackOutline} style={{ color: '#c9a84c' }} />
            </IonButton>
          </IonButtons>
          <IonTitle style={{ color: '#c9a84c', fontSize: 16, fontWeight: 700 }}>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--background': '#0a1628' } as React.CSSProperties}>
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '24px 20px 48px',
          color: '#fff',
          lineHeight: 1.75,
          fontSize: 15,
        }}>
          {children}
        </div>
      </IonContent>
    </IonPage>
  );
}
