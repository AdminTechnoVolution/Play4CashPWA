import React from 'react';
import { useT } from '../../../i18n/translations';

interface SpectatorBadgeProps {
  isSpectator?: boolean;
  /** Live spectator count from server — shown inline in the badge */
  count?: number;
}

const SpectatorBadge: React.FC<SpectatorBadgeProps> = ({ isSpectator = true, count = 0 }) => {
  const t = useT();
  if (!isSpectator) return null;

  const label = count > 0
    ? t('spectator_count_watching').replace('%d', String(count))
    : t('label_spectating') || 'Watching';

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(201,168,76,0.12)',
      border: '1.5px solid rgba(201,168,76,0.5)',
      color: 'rgba(201,168,76,0.9)',
      fontSize: 12,
      fontWeight: 700,
      padding: '4px 14px',
      borderRadius: 20,
      letterSpacing: '0.4px',
    }}>
      <span>👁</span>
      <span>{label}</span>
    </div>
  );
};

export default SpectatorBadge;
