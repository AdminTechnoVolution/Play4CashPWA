import { useCallback, useEffect, useMemo } from 'react';
import { IonIcon } from '@ionic/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trophyOutline, playCircleOutline, chevronForwardOutline } from 'ionicons/icons';
import { useAuthStore } from '../../../store/authStore';
import { officialRemainingMs, useTournamentsStore } from '../../../store/tournamentsStore';
import { useT } from '../../../i18n/translations';
import { savePlayContext } from '../../../util/routingStorage';
import {
  findMyMatchRoomId,
  formatTournamentCountdown,
  isLiveTournamentStatus,
  isMyUpcomingTournament,
  pickPrimaryMyTournament,
  tournamentUrgency,
} from '../../../util/tournamentUtils';

/**
 * Persistent floater for registered upcoming/live tournaments — helps players
 * not miss start times and jump into matches when rooms open.
 */
export default function MyTournamentsFloater() {
  const { user, authHydrated } = useAuthStore();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    list,
    bracketsById,
    matchRoomsById,
    clockTick,
    bumpClock,
    refreshMyTournaments,
    loadMatchRoom,
  } = useTournamentsStore();

  const inPlay = location.pathname.startsWith('/play/');
  const inTournamentDetail = location.pathname.startsWith('/tournaments/');

  useEffect(() => {
    if (!authHydrated || !user) return;
    void refreshMyTournaments(user.id);
    const poll = setInterval(() => void refreshMyTournaments(user.id), 20_000);
    return () => clearInterval(poll);
  }, [authHydrated, user, refreshMyTournaments]);

  useEffect(() => {
    const timer = setInterval(() => bumpClock(), 1000);
    return () => clearInterval(timer);
  }, [bumpClock]);

  const myTournaments = useMemo(() => list.filter(isMyUpcomingTournament), [list]);
  const primary = useMemo(() => pickPrimaryMyTournament(list), [list, clockTick]);

  const matchRoomId = useMemo(() => {
    if (!primary || !user) return null;
    const cached = matchRoomsById[primary.id];
    if (cached) return cached;
    const bracket = bracketsById[primary.id];
    return findMyMatchRoomId(bracket, user.id);
  }, [primary, user, matchRoomsById, bracketsById, clockTick]);

  useEffect(() => {
    if (!primary || !user || !isLiveTournamentStatus(primary.status)) return;
    void loadMatchRoom(primary.id, user.id);
  }, [primary?.id, primary?.status, user, loadMatchRoom]);

  const goToTournament = useCallback(() => {
    if (!primary) return;
    navigate(`/tournaments/${primary.id}`);
  }, [navigate, primary]);

  const joinMatch = useCallback(() => {
    if (!primary || !matchRoomId) return;
    savePlayContext({
      roomId: matchRoomId,
      betAmount: 0,
      roomName: primary.title,
      opponentName: '',
      hasOpponent: true,
      isPlayer1: true,
      isSpectator: false,
    });
    navigate(`/play/${primary.gameSocketCode}`);
  }, [navigate, primary, matchRoomId]);

  if (!authHydrated || !user || myTournaments.length === 0 || inPlay) return null;

  if (!primary) return null;

  void clockTick;
  const remaining = officialRemainingMs(primary);
  const urgency = tournamentUrgency(remaining);
  const live = isLiveTournamentStatus(primary.status);
  const canJoin = !!matchRoomId && live;

  const accent =
    canJoin ? '#4caf50' : urgency === 'imminent' ? '#ff9800' : urgency === 'soon' ? '#e8c96b' : 'var(--sovereign-gold)';

  const countdownLabel = live
    ? canJoin
      ? t('tournament_floater_match_ready')
      : t('tournament_floater_live')
    : t('tournament_floater_starts_in');

  const countdownValue = live && !canJoin ? t('tournament_floater_waiting') : formatTournamentCountdown(remaining);

  return (
    <div
      style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 10000,
        maxWidth: '520px',
        margin: '0 auto',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          borderRadius: '20px',
          overflow: 'hidden',
          border: `1px solid ${accent}55`,
          background: 'linear-gradient(160deg, rgba(22,34,58,0.97) 0%, rgba(8,14,26,0.98) 100%)',
          boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 28px ${accent}22`,
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ height: '3px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        <div style={{ padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
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
                {myTournaments.length > 1
                  ? t('tournament_floater_title_many').replace('{{count}}', String(myTournaments.length))
                  : t('tournament_floater_title')}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '15px',
                  fontWeight: 800,
                  color: 'var(--sovereign-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {primary.title}
              </p>
            </div>
            {!inTournamentDetail && (
              <button
                type="button"
                onClick={goToTournament}
                aria-label={t('tournament_floater_view')}
                style={{
                  border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--sovereign-gold)', fontSize: '20px' }} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '14px',
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '10px',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--sovereign-text-muted)', fontWeight: 600 }}>
                {countdownLabel}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: canJoin ? '16px' : '22px',
                  fontWeight: 900,
                  fontVariantNumeric: 'tabular-nums',
                  color: accent,
                  letterSpacing: '0.5px',
                }}
              >
                {countdownValue}
              </p>
            </div>
            {urgency === 'imminent' && !live && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#ff9800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  animation: 'pulse 1.5s ease infinite',
                }}
              >
                {t('tournament_floater_soon')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {canJoin ? (
              <button
                type="button"
                onClick={joinMatch}
                style={{
                  flex: 1,
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
                  boxShadow: '0 4px 16px rgba(76,175,80,0.35)',
                }}
              >
                <IonIcon icon={playCircleOutline} style={{ fontSize: '20px' }} />
                {t('tournament_go_to_match')}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToTournament}
                style={{
                  flex: 1,
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
            {myTournaments.length > 1 && (
              <button
                type="button"
                onClick={() => navigate('/tournaments')}
                style={{
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--sovereign-text)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('tournament_floater_all')}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
