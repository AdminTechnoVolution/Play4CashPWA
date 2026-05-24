import { useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { officialRemainingMs, useTournamentsStore } from '../../../store/tournamentsStore';
import { savePlayContext } from '../../../util/routingStorage';
import {
  isLiveTournamentStatus,
  isMyUpcomingTournament,
  pickPrimaryMyTournament,
  resolveJoinRoomId,
} from '../../../util/tournamentUtils';
import TournamentReminderPanel from './TournamentReminderPanel';
import TournamentMatchJoinPanel from './TournamentMatchJoinPanel';

/**
 * Persistent floater for registered upcoming/live tournaments.
 * Rendered via portal on document.body so IonSplitPane/IonContent cannot hide it.
 */
export default function MyTournamentsFloater() {
  const { user, authHydrated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    myList,
    list,
    bracketsById,
    matchRoomsById,
    clockTick,
    bumpClock,
    refreshMyTournaments,
    loadMatchRoom,
  } = useTournamentsStore();

  const inPlay = location.pathname.startsWith('/play/');
  const onDashboard = location.pathname === '/dashboard';

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
    if (!primary || !user) return null;
    return resolveJoinRoomId(primary, bracketsById[primary.id], user.id);
  }, [primary, user, bracketsById, clockTick]);

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

  if (!authHydrated || !user || myTournaments.length === 0 || inPlay || onDashboard) return null;
  if (!primary) return null;

  void clockTick;
  const remaining = officialRemainingMs(primary);

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
        <TournamentReminderPanel
          tournament={primary}
          countdownMs={remaining}
          matchRoomId={matchRoomId}
          onOpen={goToTournament}
          onJoinMatch={joinMatch}
        />
      </div>
    </div>,
    document.body,
  );
}

/** Inline banner for the dashboard — same data, always visible above the game grid. */
export function DashboardTournamentBanner() {
  const { user, authHydrated } = useAuthStore();
  const navigate = useNavigate();
  const {
    myList,
    list,
    bracketsById,
    matchRoomsById,
    clockTick,
    bumpClock,
    refreshMyTournaments,
    loadMatchRoom,
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
    if (!primary || !user) return null;
    return resolveJoinRoomId(primary, bracketsById[primary.id], user.id);
  }, [primary, user, bracketsById, clockTick]);

  useEffect(() => {
    if (!primary || !user || !isLiveTournamentStatus(primary.status)) return;
    void loadMatchRoom(primary.id, user.id);
  }, [primary?.id, primary?.status, user, loadMatchRoom]);

  if (!authHydrated || !user || !primary || myTournaments.length === 0) return null;

  void clockTick;
  const remaining = officialRemainingMs(primary);

  return (
    <div style={{ marginBottom: '20px', animation: 'fadeInUp 0.5s ease' }}>
      <TournamentReminderPanel
        tournament={primary}
        countdownMs={remaining}
        matchRoomId={matchRoomId}
        compact
        onOpen={() => navigate(`/tournaments/${primary.id}`)}
        onJoinMatch={() => {
          if (!matchRoomId) return;
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
        }}
      />
      {isLiveTournamentStatus(primary.status) && (
        <div style={{ marginTop: '12px' }}>
          <TournamentMatchJoinPanel
            tournament={primary}
            myMatch={primary.myActiveMatch}
            roomId={matchRoomId}
            onJoin={() => {
              if (!matchRoomId) return;
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
            }}
          />
        </div>
      )}
    </div>
  );
}
