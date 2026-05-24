import { useEffect } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { useTournamentsStore } from '../../../store/tournamentsStore';
import { isLiveTournamentStatus, isMyUpcomingTournament, pickPrimaryMyTournament } from '../../../util/tournamentUtils';

/**
 * Keeps tournament lobby WS + bracket polling alive app-wide so players
 * register presence on the dashboard (not only on the detail page).
 */
export default function TournamentLobbyManager() {
  const { user, authHydrated } = useAuthStore();
  const {
    myList,
    list,
    connectSocket,
    disconnectSocket,
    refreshMyTournaments,
    loadDetail,
    loadBracket,
    lobbyTournamentId,
  } = useTournamentsStore();

  const sourceList = myList.length > 0 ? myList : list;
  const primary = pickPrimaryMyTournament(sourceList);
  const needsLobby =
    !!primary &&
    isMyUpcomingTournament(primary) &&
    (isLiveTournamentStatus(primary.status) || primary.myActiveMatch?.needsLobby);

  useEffect(() => {
    if (!authHydrated || !user) return;
    void refreshMyTournaments(user.id);
    const poll = setInterval(() => void refreshMyTournaments(user.id), 12_000);
    return () => clearInterval(poll);
  }, [authHydrated, user, refreshMyTournaments]);

  useEffect(() => {
    if (!authHydrated || !user || !needsLobby || !primary) {
      if (!needsLobby) disconnectSocket();
      return;
    }
    connectSocket(primary.id);
    return () => {
      /* keep socket while another screen still needs lobby — disconnect only when needsLobby false */
    };
  }, [authHydrated, user, needsLobby, primary?.id, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (!primary || !needsLobby) return;
    void loadDetail(primary.id);
    void loadBracket(primary.id);
    const poll = setInterval(() => {
      void loadDetail(primary.id);
      void loadBracket(primary.id);
    }, 5_000);
    return () => clearInterval(poll);
  }, [primary?.id, needsLobby, loadDetail, loadBracket]);

  void lobbyTournamentId;
  return null;
}
