import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import type { TournamentSummary } from '../../../data/models/ApiModels';
import { useTournamentsStore } from '../../../store/tournamentsStore';
import { resolveTournamentPlacePrizes } from '../../../util/tournamentUtils';
import {
  hasTournamentPlacementShown,
  markTournamentPlacementShown,
} from '../../../util/tournamentPlacementStorage';
import { TOURNAMENT_PLACEMENT_CHECK_EVENT } from '../../../tournaments/tournamentSyncEvents';
import {
  gameSocketCodeFromPlayPath,
  beginPlaySessionTeardown,
  teardownPlaySession,
} from '../../../util/playBackNavigation';
import { getPlayContext } from '../../../util/routingStorage';
import TournamentPlacementModal, {
  type TournamentPlacementPayload,
} from './TournamentPlacementModal';

function resolvePlacement(t: TournamentSummary): TournamentPlacementPayload | null {
  if (t.status !== 'finished') return null;
  const regStatus = t.myRegistration?.status;
  if (regStatus !== 'winner' && regStatus !== 'runner_up') return null;
  if (hasTournamentPlacementShown(t.id)) return null;

  const rank: 1 | 2 = regStatus === 'winner' ? 1 : 2;
  const prizes = resolveTournamentPlacePrizes(t);
  const prizeAmount = rank === 1 ? prizes.firstPlace : prizes.secondPlace;

  return {
    tournamentId: t.id,
    title: t.title,
    rank,
    prizeAmount,
  };
}

/**
 * Surfaces a celebratory podium modal when the user finishes 1st or 2nd in a tournament.
 */
export default function TournamentPlacementManager() {
  const navigate = useNavigate();
  const { user, authHydrated } = useAuthStore();
  const detail = useTournamentsStore((s) => s.detail);
  const myList = useTournamentsStore((s) => s.myList);
  const [payload, setPayload] = useState<TournamentPlacementPayload | null>(null);
  const payloadRef = useRef<TournamentPlacementPayload | null>(null);
  payloadRef.current = payload;

  const consider = useCallback((t: TournamentSummary | null | undefined) => {
    if (!t || payloadRef.current) return;
    const next = resolvePlacement(t);
    if (next) setPayload(next);
  }, []);

  useEffect(() => {
    if (payload) return;
    consider(detail);
    for (const t of myList) consider(t);
  }, [detail, myList, payload, consider]);

  useEffect(() => {
    if (!authHydrated || !user || payload) return;

    const onPlacementCheck = (ev: Event) => {
      if (payloadRef.current) return;
      consider((ev as CustomEvent<TournamentSummary>).detail);
    };

    window.addEventListener(TOURNAMENT_PLACEMENT_CHECK_EVENT, onPlacementCheck);
    return () => window.removeEventListener(TOURNAMENT_PLACEMENT_CHECK_EVENT, onPlacementCheck);
  }, [authHydrated, user, payload, consider]);

  const onDismiss = () => {
    const tournamentId = payload?.tournamentId;
    const onPlayRoute = window.location.pathname.startsWith('/play/');
    const playCtx = getPlayContext();
    const gameCode = gameSocketCodeFromPlayPath();

    if (payload) {
      markTournamentPlacementShown(payload.tournamentId);
    }
    setPayload(null);

    if (onPlayRoute) {
      beginPlaySessionTeardown();
      teardownPlaySession(gameCode, playCtx?.roomId);
      navigate(tournamentId ? `/tournaments/${tournamentId}` : '/tournaments', { replace: true });
    }

    void useAuthStore.getState().loadSession();
    void useTournamentsStore.getState().refreshMyTournaments(user?.id);
  };

  return <TournamentPlacementModal payload={payload} onDismiss={onDismiss} />;
}
