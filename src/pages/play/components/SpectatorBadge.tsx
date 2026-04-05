import React from 'react';
import { IonBadge } from '@ionic/react';
import { useT } from '../../../i18n/translations';

interface SpectatorBadgeProps {
  isSpectator?: boolean;
}

const SpectatorBadge: React.FC<SpectatorBadgeProps> = ({ isSpectator = true }) => {
  const t = useT();
  if (!isSpectator) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <IonBadge
        style={{
          background: 'transparent',
          border: '1.5px solid var(--sovereign-gold)',
          color: 'var(--sovereign-gold)',
          fontSize: '13px',
          fontWeight: '700',
          padding: '6px 14px',
          borderRadius: '20px',
          letterSpacing: '0.5px',
        }}
      >
        👁 {t('APP.GAME.SPECTATING')}
      </IonBadge>
    </div>
  );
};

export default SpectatorBadge;
