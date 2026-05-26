import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthStore } from '../../../store/authStore';
import { apiRepository } from '../../../data/network/ApiRepository';
import { useTournamentsStore } from '../../../store/tournamentsStore';
import {
  planTournamentSyncTick,
  pickSocketTournament,
  type TournamentSyncFocus,
} from '../../../tournaments/tournamentSyncPolicy';
import { dispatchTournamentPlacementCheck } from '../../../tournaments/tournamentSyncEvents';
import { readTrackedTournamentIds } from '../../../util/tournamentRegistrationStorage';
import { hasTournamentPlacementShown } from '../../../util/tournamentPlacementStorage';

type TournamentSyncContextValue = {
  registerFocus: (focus: TournamentSyncFocus) => () => void;
};

const TournamentSyncContext = createContext<TournamentSyncContextValue | null>(null);

function focusKey(f: TournamentSyncFocus): string {
  if (f.kind === 'background') return 'background';
  return `${f.kind}:${f.tournamentId}`;
}

function focusPriority(key: string): number {
  if (key.startsWith('bracket:')) return 3;
  if (key.startsWith('detail:')) return 2;
  return 0;
}

function resolveActiveFocus(counts: Map<string, number>): TournamentSyncFocus {
  let bestKey = 'background';
  let bestPri = 0;
  for (const [key, n] of counts) {
    if (n <= 0) continue;
    const pri = focusPriority(key);
    if (pri > bestPri) {
      bestPri = pri;
      bestKey = key;
    }
  }
  if (bestKey.startsWith('bracket:')) {
    return { kind: 'bracket', tournamentId: bestKey.slice('bracket:'.length) };
  }
  if (bestKey.startsWith('detail:')) {
    return { kind: 'detail', tournamentId: bestKey.slice('detail:'.length) };
  }
  return { kind: 'background' };
}

/** Single app-wide tournament sync loop (replaces duplicate 12s/15s/2.5s pollers). */
export default function TournamentSyncProvider({ children }: { children?: ReactNode }) {
  const { user, authHydrated } = useAuthStore();
  const userId = user?.id;

  const focusCountsRef = useRef(new Map<string, number>());
  const visibleRef = useRef(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);
  const lastPlacementCheckRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInFlightRef = useRef(false);

  const registerFocus = useCallback((focus: TournamentSyncFocus) => {
    const key = focusKey(focus);
    const counts = focusCountsRef.current;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return () => {
      const next = (counts.get(key) ?? 1) - 1;
      if (next <= 0) counts.delete(key);
      else counts.set(key, next);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!authHydrated || !userId) {
      useTournamentsStore.getState().disconnectSocket();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    const scheduleNext = (delayMs: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void runTick(), delayMs);
    };

    const runPlacementChecks = async () => {
      const ids = readTrackedTournamentIds().filter((id) => !hasTournamentPlacementShown(id));
      if (ids.length === 0) return;
      lastPlacementCheckRef.current = Date.now();
      await Promise.all(
        ids.map(async (id) => {
          try {
            const t = await apiRepository.getTournament(id);
            if (t.status === 'finished') dispatchTournamentPlacementCheck(t);
          } catch {
            /* ignore */
          }
        }),
      );
    };

    const manageLobbySocket = () => {
      const st = useTournamentsStore.getState();
      const focus = resolveActiveFocus(focusCountsRef.current);
      const socketTarget = pickSocketTournament(focus, st.myList, st.list);
      if (socketTarget) {
        if (st.lobbyTournamentId !== socketTarget.id) st.connectSocket(socketTarget.id);
      } else if (st.lobbyTournamentId) {
        st.disconnectSocket();
      }
    };

    const runTick = async () => {
      if (tickInFlightRef.current) {
        scheduleNext(5_000);
        return;
      }
      tickInFlightRef.current = true;
      let nextDelay = 120_000;

      try {
        await useTournamentsStore.getState().refreshMyTournaments(userId, { liveDetailMode: 'none' });
        manageLobbySocket();

        const plan = planTournamentSyncTick({
          visible: visibleRef.current,
          focus: resolveActiveFocus(focusCountsRef.current),
          myList: useTournamentsStore.getState().myList,
          catalogList: useTournamentsStore.getState().list,
          lastPlacementCheckAt: lastPlacementCheckRef.current,
          lobbySocketConnected: useTournamentsStore.getState().lobbyTournamentId != null,
          socketTournamentId: useTournamentsStore.getState().lobbyTournamentId,
        });
        nextDelay = plan.delayMs;

        const loads: Promise<unknown>[] = [];
        const st = useTournamentsStore.getState();
        if (plan.hydratePrimaryLive && plan.primaryDetailId) {
          loads.push(st.loadDetail(plan.primaryDetailId, { silent: true }));
          if (plan.primaryBracketId) loads.push(st.loadBracket(plan.primaryBracketId, { silent: true }));
        }
        if (plan.focusDetailId) loads.push(st.loadDetail(plan.focusDetailId, { silent: true }));
        if (plan.focusBracketId) loads.push(st.loadBracket(plan.focusBracketId, { silent: true }));
        await Promise.all(loads);

        if (plan.checkPlacements) await runPlacementChecks();
      } finally {
        tickInFlightRef.current = false;
        scheduleNext(nextDelay);
      }
    };

    void runTick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      useTournamentsStore.getState().disconnectSocket();
    };
  }, [authHydrated, userId]);

  return (
    <TournamentSyncContext.Provider value={{ registerFocus }}>
      {children}
    </TournamentSyncContext.Provider>
  );
}

export function useTournamentSyncFocus(focus: TournamentSyncFocus): void {
  const ctx = useContext(TournamentSyncContext);
  const tournamentId = focus.kind === 'background' ? '' : focus.tournamentId;
  const kind = focus.kind;

  useEffect(() => {
    if (!ctx) return;
    const resolved: TournamentSyncFocus =
      kind === 'background'
        ? { kind: 'background' }
        : kind === 'bracket'
          ? { kind: 'bracket', tournamentId }
          : { kind: 'detail', tournamentId };
    return ctx.registerFocus(resolved);
  }, [ctx, kind, tournamentId]);
}
