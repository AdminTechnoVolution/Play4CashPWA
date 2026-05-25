import { useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { tournamentCountdownMs, useTournamentsStore } from '../../../store/tournamentsStore';
import { savePlayContext } from '../../../util/routingStorage';
import { tournamentDebugLog } from '../../../debug/tournamentDebugLog';
import {
  isMyUpcomingTournament,
  pickPrimaryMyTournament,
  resolveJoinRoomId,
  shouldFocusTournamentMatch,
} from '../../../util/tournamentUtils';
import TournamentReminderPanel from './TournamentReminderPanel';
import TournamentMatchJoinPanel from './TournamentMatchJoinPanel';

function useTournamentBannerData() {
  const { user, authHydrated } = useAuthStore();
  const {
    myList,
    list,
    clockTick,
    bumpClock,
    refreshMyTournaments,
  } = useTournamentsStore();

  useEffect(() => {
    if (!authHydrated || !user) return;
    void refreshMyTournaments(user.id);
    const poll = setInterval(() => void refreshMyTournaments(user.id), 15_000);
    return () => clearInterval(poll);
  }, [authHydrated, user, refreshMyTournaments]);

  useEffect(() => {
    const timer = setInterval(() => bumpClock(), 1000);
    return () => clearInterval(timer);
  }, [bumpClock]);

  const sourceList = myList.length > 0 ? myList : list;
  const myTournaments = useMemo(() => sourceList.filter(isMyUpcomingTournament), [sourceList]);
  const primary = useMemo(() => pickPrimaryMyTournament(sourceList), [sourceList, clockTick]);

  const matchRoomId = useMemo(() => {
    if (!primary) return null;
    return resolveJoinRoomId(primary);
  }, [primary, clockTick]);

  const focusMatch = shouldFocusTournamentMatch(primary);

  return { authHydrated, user, myTournaments, primary, matchRoomId, focusMatch, clockTick };
}

function joinTournamentMatch(
  navigate: ReturnType<typeof useNavigate>,
  primary: NonNullable<ReturnType<typeof pickPrimaryMyTournament>>,
  matchRoomId: string,
) {
  // #region agent log
  tournamentDebugLog(
    'MyTournamentsFloater.tsx:joinTournamentMatch',
    'navigating to tournament match',
    {
      tournamentId: primary.id,
      tournamentStatus: primary.status,
      gameSocketCode: primary.gameSocketCode,
      roomId: matchRoomId,
      myActiveMatch: primary.myActiveMatch ?? null,
    },
    'H4',
  );
  // #endregion
  savePlayContext({
    roomId: matchRoomId,
    betAmount: 0,
    roomName: primary.title,
    opponentName: primary.myActiveMatch?.opponentUsername ?? '',
    hasOpponent: true,
    isPlayer1: true,
    isSpectator: false,
  });
  navigate(`/play/${primary.gameSocketCode}`);
}

export default function MyTournamentsFloater() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authHydrated, user, myTournaments, primary, matchRoomId, focusMatch, clockTick } =
    useTournamentBannerData();

  const inPlay = location.pathname.startsWith('/play/');
  const onDashboard = location.pathname === '/dashboard';
  const onTournamentDetail =
    !!primary && location.pathname === `/tournaments/${primary.id}`;

  const goToTournament = useCallback(() => {
    if (!primary) return;
    navigate(`/tournaments/${primary.id}`);
  }, [navigate, primary]);

  const joinMatch = useCallback(() => {
    if (!primary || !matchRoomId) return;
    joinTournamentMatch(navigate, primary, matchRoomId);
  }, [navigate, primary, matchRoomId]);

  if (!authHydrated || !user || myTournaments.length === 0 || inPlay || onDashboard) return null;
  if (!primary) return null;
  if (focusMatch && onTournamentDetail) return null;

  void clockTick;
  const remaining = tournamentCountdownMs(primary);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: '12px',
        right: '12px',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 99998,
        maxWidth: '520px',
        margin: '0 auto',
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        {focusMatch ? (
          <TournamentMatchJoinPanel
            tournament={primary}
            myMatch={primary.myActiveMatch}
            roomId={matchRoomId}
            onJoin={joinMatch}
          />
        ) : (
          <TournamentReminderPanel
            tournament={primary}
            countdownMs={remaining}
            matchRoomId={matchRoomId}
            onOpen={goToTournament}
            onJoinMatch={joinMatch}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Inline banner for the dashboard — same data, always visible above the game grid. */
export function DashboardTournamentBanner() {
  const navigate = useNavigate();
  const { authHydrated, user, myTournaments, primary, matchRoomId, focusMatch } =
    useTournamentBannerData();

  if (!authHydrated || !user || !primary || myTournaments.length === 0) return null;

  const onJoin = () => {
    if (!matchRoomId) return;
    joinTournamentMatch(navigate, primary, matchRoomId);
  };

  if (focusMatch) {
    return (
      <div style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
        <TournamentMatchJoinPanel
          tournament={primary}
          myMatch={primary.myActiveMatch}
          roomId={matchRoomId}
          onJoin={onJoin}
        />
      </div>
    );
  }

  const remaining = tournamentCountdownMs(primary);

  return (
    <div style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
      <TournamentReminderPanel
        tournament={primary}
        countdownMs={remaining}
        matchRoomId={matchRoomId}
        compact
        onOpen={() => navigate(`/tournaments/${primary.id}`)}
        onJoinMatch={onJoin}
      />
    </div>
  );
}
