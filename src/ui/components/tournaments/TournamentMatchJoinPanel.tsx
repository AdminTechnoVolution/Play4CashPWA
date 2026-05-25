import { IonButton, IonIcon } from '@ionic/react';
import { playCircleOutline, radioButtonOnOutline, timeOutline } from 'ionicons/icons';
import type { TournamentMyActiveMatch, TournamentSummary } from '../../../data/models/ApiModels';
import { useT } from '../../../i18n/translations';
import {
  formatTournamentCountdown,
  getTournamentMatchUiState,
  isActiveTournamentPlayer,
} from '../../../util/tournamentUtils';
import { officialPauseRemainingMs, useTournamentsStore } from '../../../store/tournamentsStore';

type Props = {
  tournament: TournamentSummary;
  myMatch: TournamentMyActiveMatch | null | undefined;
  roomId: string | null;
  onJoin: () => void;
};

export default function TournamentMatchJoinPanel({ tournament, myMatch, roomId, onJoin }: Props) {
  const t = useT();
  const clockTick = useTournamentsStore((s) => s.clockTick);
  void clockTick;

  if (!isActiveTournamentPlayer(tournament)) return null;

  const uiState = getTournamentMatchUiState(tournament);
  if (uiState === 'none') return null;

  const canJoin = uiState === 'ready';
  const needsLobby = uiState === 'lobby';
  const joinRoomId = canJoin ? (roomId ?? myMatch?.roomId ?? null) : null;
  const presenceMs = myMatch?.presenceCheckAt
    ? Math.max(0, Date.parse(myMatch.presenceCheckAt) - Date.now())
    : 0;

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '16px',
        borderRadius: '16px',
        border: canJoin ? '1px solid rgba(76,175,80,0.55)' : '1px solid rgba(255,152,0,0.45)',
        background: canJoin ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <IonIcon
          icon={canJoin ? playCircleOutline : radioButtonOnOutline}
          style={{ color: canJoin ? '#81c784' : '#ffb74d', fontSize: '22px' }}
        />
        <p style={{ margin: 0, fontWeight: 800, fontSize: '15px', color: 'var(--sovereign-text)' }}>
          {canJoin ? t('tournament_match_ready_title') : t('tournament_match_pending_title')}
        </p>
      </div>

      {myMatch?.roundName && (
        <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--sovereign-text-muted)' }}>
          {myMatch.roundName.replace(/_/g, ' ')}
        </p>
      )}

      {myMatch?.opponentUsername && (
        <p style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--sovereign-text)' }}>
          {t('tournament_match_vs').replace('{{name}}', myMatch.opponentUsername)}
        </p>
      )}

      {needsLobby && (
        <>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#ffb74d', lineHeight: 1.45 }}>
            {t('tournament_lobby_stay')}
          </p>
          {presenceMs > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <IonIcon icon={timeOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '16px' }} />
              <span style={{ color: 'var(--sovereign-gold)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {t('tournament_presence_in')}: {formatTournamentCountdown(presenceMs)}
              </span>
            </div>
          )}
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--sovereign-text-muted)' }}>
            {t('tournament_lobby_presence_hint')}
          </p>
        </>
      )}

      {canJoin && joinRoomId && (
        <>
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#a5d6a7' }}>
            {t('tournament_join_match_now')}
          </p>
          <IonButton expand="block" color="success" onClick={onJoin}>
            <IonIcon icon={playCircleOutline} slot="start" />
            {t('tournament_go_to_match')}
          </IonButton>
        </>
      )}

      {!canJoin && !needsLobby && tournament.status === 'between_rounds' && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--sovereign-text-muted)' }}>
          {t('tournament_between_rounds_wait')}{' '}
          {formatTournamentCountdown(officialPauseRemainingMs(tournament) ?? 0)}
        </p>
      )}

      {!canJoin && !needsLobby && tournament.status === 'finals_pending' && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--sovereign-text-muted)' }}>
          {t('tournament_finals_starts_in')}{' '}
          {formatTournamentCountdown(officialPauseRemainingMs(tournament) ?? 0)}
        </p>
      )}
    </div>
  );
}
