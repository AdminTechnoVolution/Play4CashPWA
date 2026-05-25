import type { CSSProperties } from 'react';
import { IonIcon, IonModal } from '@ionic/react';
import { medalOutline, trophyOutline } from 'ionicons/icons';
import { SovereignPrimaryButton } from '../SovereignButton';
import { useT } from '../../../i18n/translations';
import { formatUSD } from '../../../util/formatCurrency';

export type TournamentPlacementPayload = {
  tournamentId: string;
  title: string;
  rank: 1 | 2;
  prizeAmount: number;
};

type Props = {
  payload: TournamentPlacementPayload | null;
  onDismiss: () => void;
};

export default function TournamentPlacementModal({ payload, onDismiss }: Props) {
  const t = useT();
  if (!payload) return null;

  const isFirst = payload.rank === 1;
  const accent = isFirst ? 'var(--sovereign-gold)' : '#b0bec5';
  const accentSoft = isFirst ? 'rgba(201,168,76,0.18)' : 'rgba(176,190,197,0.16)';
  const accentBorder = isFirst ? 'rgba(201,168,76,0.55)' : 'rgba(176,190,197,0.45)';

  return (
    <IonModal
      isOpen
      backdropDismiss={false}
      style={
        {
          '--background': 'transparent',
          '--backdrop-opacity': '0.72',
        } as CSSProperties
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(165deg, rgba(22,34,58,0.98) 0%, rgba(8,14,26,0.98) 100%)',
            borderRadius: 20,
            padding: '28px 24px 22px',
            width: '100%',
            maxWidth: 360,
            border: `1px solid ${accentBorder}`,
            boxShadow: `0 16px 48px rgba(0,0,0,0.55), 0 0 32px ${accentSoft}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              margin: '0 auto',
              borderRadius: 20,
              background: accentSoft,
              border: `1px solid ${accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IonIcon
              icon={isFirst ? trophyOutline : medalOutline}
              style={{ fontSize: 40, color: accent }}
            />
          </div>

          <p style={{ margin: 0, color: accent, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
            {isFirst ? t('tournament_placement_title_first') : t('tournament_placement_title_second')}
          </p>

          <p style={{ margin: 0, color: 'var(--sovereign-text)', fontSize: 15, fontWeight: 700, lineHeight: 1.45 }}>
            {isFirst ? t('tournament_placement_rank_first') : t('tournament_placement_rank_second')}
          </p>

          <p style={{ margin: 0, color: 'var(--sovereign-text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            {payload.title}
          </p>

          <p style={{ margin: 0, color: 'var(--sovereign-text)', fontSize: 14, lineHeight: 1.55 }}>
            {isFirst ? t('tournament_placement_body_first') : t('tournament_placement_body_second')}
          </p>

          {payload.prizeAmount > 0 && (
            <div
              style={{
                background: accentSoft,
                border: `1px solid ${accentBorder}`,
                borderRadius: 12,
                padding: '12px 16px',
              }}
            >
              <p style={{ margin: 0, color: accent, fontSize: 20, fontWeight: 900 }}>
                + {formatUSD(payload.prizeAmount)} USDT
              </p>
              <p style={{ margin: '4px 0 0', color: 'var(--sovereign-text-muted)', fontSize: 12, fontWeight: 600 }}>
                {t('tournament_placement_prize_label')}
              </p>
            </div>
          )}

          <SovereignPrimaryButton onClick={onDismiss} style={{ marginTop: 4 }}>
            {t('ok')}
          </SovereignPrimaryButton>
        </div>
      </div>
    </IonModal>
  );
}
