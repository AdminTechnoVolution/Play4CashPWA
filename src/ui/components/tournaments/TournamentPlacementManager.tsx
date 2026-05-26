import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { apiRepository } from '../../../data/network/ApiRepository';
import type { TournamentSummary } from '../../../data/models/ApiModels';
import { useTournamentsStore } from '../../../store/tournamentsStore';
import { readTrackedTournamentIds } from '../../../util/tournamentRegistrationStorage';
import { resolveTournamentPlacePrizes } from '../../../util/tournamentUtils';
import {
  hasTournamentPlacementShown,
  markTournamentPlacementShown,
} from '../../../util/tournamentPlacementStorage';
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

    const poll = async () => {
      if (payloadRef.current) return;
      const ids = readTrackedTournamentIds();
      if (ids.length === 0) return;

      await Promise.all(
        ids.map(async (id) => {
          if (payloadRef.current) return;
          try {
            const t = await apiRepository.getTournament(id);
            consider(t);
          } catch {
            /* ignore */
          }
        }),
      );
    };

    void poll();
    const timer = setInterval(() => void poll(), 2500);
    return () => clearInterval(timer);
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
