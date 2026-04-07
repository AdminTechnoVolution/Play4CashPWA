import React from 'react';
import {
  IonModal,
  IonIcon,
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
      <div
        style={{
          background: 'var(--sovereign-surface)',
          borderTop: '1px solid var(--sovereign-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 0 16px',
          }}
        >
          <span
            style={{
              color: 'var(--sovereign-error)',
              fontWeight: 700,
              fontSize: '16px',
            }}
          >
            Error
          </span>
          <IonIcon
            icon={closeOutline}
            onClick={onDismiss}
            style={{
              color: 'var(--sovereign-text-muted)',
              fontSize: '24px',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '24px 24px 32px 24px',
          }}
        >
          <IonIcon
            icon={alertCircleOutline}
            style={{
              fontSize: '56px',
              color: 'var(--sovereign-error)',
            }}
          />

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

          <SovereignPrimaryButton
            onClick={onDismiss}
            style={{ minWidth: '140px' } as React.CSSProperties}
          >
            OK
          </SovereignPrimaryButton>
        </div>
      </div>
    </IonModal>
  );
};

export default GenericErrorModal;
