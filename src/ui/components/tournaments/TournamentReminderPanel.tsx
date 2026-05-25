import { IonIcon } from '@ionic/react';
import { playCircleOutline, trophyOutline } from 'ionicons/icons';
import type { TournamentSummary } from '../../../data/models/ApiModels';
import { officialPauseRemainingMs } from '../../../store/tournamentsStore';
import { useT } from '../../../i18n/translations';
import {
  formatTournamentCountdown,
  getTournamentMatchUiState,
  isActiveTournamentPlayer,
  isLiveTournamentStatus,
  tournamentUrgency,
} from '../../../util/tournamentUtils';

type Props = {
  tournament: TournamentSummary;
  countdownMs: number;
  matchRoomId?: string | null;
  onOpen: () => void;
  onJoinMatch?: () => void;
  compact?: boolean;
};

export default function TournamentReminderPanel({
  tournament,
  countdownMs,
  matchRoomId,
  onOpen,
  onJoinMatch,
  compact = false,
}: Props) {
  const t = useT();
  const urgency = tournamentUrgency(countdownMs);
  const live = isLiveTournamentStatus(tournament.status);
  const canJoin =
    isActiveTournamentPlayer(tournament) &&
    getTournamentMatchUiState(tournament) === 'ready';
  const pauseMs = officialPauseRemainingMs(tournament);
  const inRoundPause =
    live &&
    !canJoin &&
    pauseMs != null &&
    pauseMs > 0 &&
    (tournament.status === 'between_rounds' || tournament.status === 'finals_pending');

  const accent =
    canJoin ? '#4caf50' : urgency === 'imminent' ? '#ff9800' : urgency === 'soon' ? '#e8c96b' : 'var(--sovereign-gold)';

  const countdownLabel = live
    ? canJoin
      ? t('tournament_floater_match_ready')
      : inRoundPause
        ? tournament.status === 'finals_pending'
          ? t('tournament_floater_finals_in')
          : t('tournament_floater_next_round_in')
        : t('tournament_floater_live')
    : t('tournament_floater_starts_in');

  const countdownValue = inRoundPause
    ? formatTournamentCountdown(pauseMs)
    : live && !canJoin
      ? t('tournament_floater_waiting')
      : formatTournamentCountdown(countdownMs);

  return (
    <div
      style={{
        borderRadius: compact ? '16px' : '20px',
        overflow: 'hidden',
        border: `1px solid ${accent}66`,
        background: 'linear-gradient(160deg, rgba(22,34,58,0.98) 0%, rgba(8,14,26,0.98) 100%)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 24px ${accent}18`,
      }}
    >
      <div style={{ height: '3px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div style={{ padding: compact ? '14px' : '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${accent}cc, ${accent})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IonIcon icon={trophyOutline} style={{ color: '#111', fontSize: '22px' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: accent,
              }}
            >
              {t('tournament_floater_title')}
            </p>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: '16px',
                fontWeight: 800,
                color: 'var(--sovereign-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tournament.title}
            </p>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '12px',
            marginBottom: '12px',
            borderRadius: '14px',
            background: 'rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--sovereign-text-muted)', fontWeight: 600 }}>
            {countdownLabel}
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: compact ? '28px' : '32px',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              color: accent,
              letterSpacing: '1px',
              lineHeight: 1.1,
            }}
          >
            {countdownValue}
          </p>
          {urgency === 'imminent' && !live && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', fontWeight: 800, color: '#ff9800' }}>
              {t('tournament_floater_soon')}
            </p>
          )}
        </div>

        {canJoin ? (
          <button
            type="button"
            onClick={onJoinMatch}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 14px',
              background: 'linear-gradient(135deg, #43a047, #66bb6a)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <IonIcon icon={playCircleOutline} style={{ fontSize: '20px' }} />
            {t('tournament_go_to_match')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 14px',
              background: 'linear-gradient(135deg, #b8922a, #e8c96b)',
              color: '#1a1200',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {live ? t('tournament_floater_open_lobby') : t('tournament_floater_view')}
          </button>
        )}
      </div>
    </div>
  );
}
