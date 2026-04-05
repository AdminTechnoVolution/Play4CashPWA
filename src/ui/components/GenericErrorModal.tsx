import React from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonText,
} from '@ionic/react';
import { alertCircleOutline, closeOutline } from 'ionicons/icons';
import { SovereignPrimaryButton } from './SovereignButton';

interface GenericErrorModalProps {
  isOpen: boolean;
  message: string;
  onDismiss: () => void;
}

const GenericErrorModal: React.FC<GenericErrorModalProps> = ({
  isOpen,
  message,
  onDismiss,
}) => {
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      breakpoints={[0, 1]}
      initialBreakpoint={1}
      style={{ '--height': 'auto' } as React.CSSProperties}
    >
      <IonHeader>
        <IonToolbar
          style={{
            '--background': 'var(--sovereign-surface)',
            '--border-color': 'var(--sovereign-border)',
          } as React.CSSProperties}
        >
          <IonTitle
            style={{
              color: 'var(--sovereign-error)',
              fontWeight: 700,
              fontSize: '16px',
            }}
          >
            Error
          </IonTitle>
          <IonIcon
            icon={closeOutline}
            slot="end"
            onClick={onDismiss}
            style={{
              color: 'var(--sovereign-text-muted)',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '16px',
            }}
          />
        </IonToolbar>
      </IonHeader>

      <IonContent
        style={{
          '--background': 'var(--sovereign-surface)',
        } as React.CSSProperties}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '32px 24px',
          }}
        >
          <IonIcon
            icon={alertCircleOutline}
            style={{
              fontSize: '56px',
              color: 'var(--sovereign-error)',
            }}
          />

          <IonText>
            <p
              style={{
                color: 'var(--sovereign-text)',
                textAlign: 'center',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: 0,
              }}
            >
              {message}
            </p>
          </IonText>

          <SovereignPrimaryButton
            onClick={onDismiss}
            style={{ minWidth: '140px' } as React.CSSProperties}
          >
            OK
          </SovereignPrimaryButton>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default GenericErrorModal;
