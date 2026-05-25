import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import type { TournamentBracketResponse, TournamentSummary } from '../data/models/ApiModels';
import { TournamentSocketManager } from '../data/network/TournamentSocketManager';
import { isMyUpcomingTournament, resolveJoinRoomId } from '../util/tournamentUtils';
import { tournamentDebugLog } from '../debug/tournamentDebugLog';
import {
  readTrackedTournamentIds,
  trackRegisteredTournament,
  untrackRegisteredTournament,
} from '../util/tournamentRegistrationStorage';

interface TournamentsStore {
  list: TournamentSummary[];
  myList: TournamentSummary[];
  detail: TournamentSummary | null;
  bracket: TournamentBracketResponse | null;
  bracketsById: Record<string, TournamentBracketResponse>;
  matchRoomsById: Record<string, string | null>;
  loading: boolean;
  error: string | null;
  clockTick: number;
  lobbyTournamentId: string | null;
  loadList: () => Promise<void>;
  loadDetail: (id: string) => Promise<void>;
  loadBracket: (id: string) => Promise<TournamentBracketResponse | null>;
  loadMatchRoom: (tournamentId: string, userId: string) => Promise<string | null>;
  register: (id: string) => Promise<void>;
  unregister: (id: string) => Promise<void>;
  applyServerState: (data: TournamentSummary) => void;
  connectSocket: (id: string) => void;
  disconnectSocket: () => void;
  bumpClock: () => void;
  refreshMyTournaments: (userId?: string) => Promise<void>;
}

let socketManager: TournamentSocketManager | null = null;

function serverOffsetMs(serverNow: string): number {
  const parsed = Date.parse(serverNow);
  if (!Number.isFinite(parsed)) return 0;
  return parsed - Date.now();
}

export function officialRemainingMs(t: TournamentSummary): number {
  if (typeof t.remainingMs === 'number' && Number.isFinite(t.remainingMs) && t.remainingMs >= 0) {
    const fetchedAt = Date.parse(t.serverNow);
    if (Number.isFinite(fetchedAt)) {
      const elapsed = Date.now() - fetchedAt;
      return Math.max(0, t.remainingMs - elapsed);
    }
  }
  const offset = serverOffsetMs(t.serverNow);
  const now = Date.now() + offset;
  const starts = Date.parse(t.startsAt);
  if (!Number.isFinite(starts)) return 0;
  return Math.max(0, starts - now);
}

/** Countdown until the next round/final activates (server-synced). */
export function officialPauseRemainingMs(t: TournamentSummary): number | null {
  if (t.pauseRemainingMs == null || !Number.isFinite(t.pauseRemainingMs) || t.pauseRemainingMs < 0) {
    return null;
  }
  const fetchedAt = Date.parse(t.serverNow);
  if (Number.isFinite(fetchedAt)) {
    const elapsed = Date.now() - fetchedAt;
    return Math.max(0, t.pauseRemainingMs - elapsed);
  }
  return t.pauseRemainingMs;
}

/** Primary countdown for cards/floater: pause between rounds when active, else start time. */
export function tournamentCountdownMs(t: TournamentSummary): number {
  const pause = officialPauseRemainingMs(t);
  if (
    pause != null &&
    pause > 0 &&
    (t.status === 'between_rounds' || t.status === 'finals_pending')
  ) {
    return pause;
  }
  return officialRemainingMs(t);
}

function patchListItem(list: TournamentSummary[], id: string, patch: Partial<TournamentSummary>): TournamentSummary[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function mergeMyList(existing: TournamentSummary[], incoming: TournamentSummary[]): TournamentSummary[] {
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

async function hydrateTrackedDetails(userId: string): Promise<TournamentSummary[]> {
  const tracked = readTrackedTournamentIds();
  if (tracked.length === 0) return [];
  const results = await Promise.all(
    tracked.map(async (id) => {
      try {
        return await apiRepository.getTournament(id);
      } catch {
        return null;
      }
    }),
  );
  return results.filter((t): t is TournamentSummary => !!t && isMyUpcomingTournament(t));
}

export const useTournamentsStore = create<TournamentsStore>((set, get) => ({
  list: [],
  myList: [],
  detail: null,
  bracket: null,
  bracketsById: {},
  matchRoomsById: {},
  loading: false,
  error: null,
  clockTick: 0,
  lobbyTournamentId: null,

  bumpClock() {
    set((s) => ({ clockTick: s.clockTick + 1 }));
  },

  async loadList() {
    set({ loading: true, error: null });
    try {
      const list = await apiRepository.getTournaments();
      set({ list, loading: false });
    } catch {
      set({ loading: false, error: 'tournament_load_error' });
    }
  },

  async loadDetail(id) {
    set({ loading: true, error: null });
    try {
      const detail = await apiRepository.getTournament(id);
      if (isMyUpcomingTournament(detail)) trackRegisteredTournament(id);
      set((s) => ({
        detail,
        loading: false,
        list: patchListItem(s.list, id, detail),
        myList: isMyUpcomingTournament(detail)
          ? mergeMyList(s.myList, [detail])
          : s.myList.filter((t) => t.id !== id),
        matchRoomsById: {
          ...s.matchRoomsById,
          [id]: detail.myActiveMatch?.canJoin ? detail.myActiveMatch.roomId ?? null : null,
        },
      }));
    } catch {
      set({ loading: false, error: 'tournament_load_error' });
    }
  },

  async loadBracket(id): Promise<TournamentBracketResponse | null> {
    try {
      const bracket = await apiRepository.getTournamentBracket(id);
      set((s) => ({
        bracket: s.detail?.id === id ? bracket : s.bracket,
        bracketsById: { ...s.bracketsById, [id]: bracket },
      }));
      return bracket;
    } catch {
      set({ error: 'tournament_bracket_error' });
      return null;
    }
  },

  async loadMatchRoom(tournamentId, _userId) {
    const tournament =
      get().detail?.id === tournamentId
        ? get().detail
        : get().myList.find((t) => t.id === tournamentId) ??
          get().list.find((t) => t.id === tournamentId);
    const roomId = tournament ? resolveJoinRoomId(tournament) : null;
    set((s) => ({
      matchRoomsById: { ...s.matchRoomsById, [tournamentId]: roomId },
    }));
    return roomId;
  },

  async register(id) {
    await apiRepository.registerTournament(id);
    trackRegisteredTournament(id);
    set((s) => {
      const reg = { status: 'registered' as const };
      const detail =
        s.detail?.id === id
          ? {
              ...s.detail,
              myRegistration: reg,
              registeredCount: Math.min(s.detail.maxPlayers, s.detail.registeredCount + 1),
            }
          : s.detail;
      const patched = {
        myRegistration: reg,
        registeredCount: Math.min(
          s.list.find((t) => t.id === id)?.maxPlayers ?? 0,
          (s.list.find((t) => t.id === id)?.registeredCount ?? 0) + 1,
        ),
      };
      const listItem = s.list.find((t) => t.id === id);
      const myEntry = listItem ? { ...listItem, ...patched } : null;
      return {
        detail,
        list: patchListItem(s.list, id, patched),
        myList: myEntry && isMyUpcomingTournament(myEntry) ? mergeMyList(s.myList, [myEntry]) : s.myList,
      };
    });
    await get().loadDetail(id);
    await get().refreshMyTournaments();
  },

  async unregister(id) {
    await apiRepository.unregisterTournament(id);
    untrackRegisteredTournament(id);
    set((s) => ({
      detail:
        s.detail?.id === id
          ? {
              ...s.detail,
              myRegistration: null,
              registeredCount: Math.max(0, s.detail.registeredCount - 1),
            }
          : s.detail,
      list: patchListItem(s.list, id, {
        myRegistration: null,
        registeredCount: Math.max(0, (s.list.find((t) => t.id === id)?.registeredCount ?? 1) - 1),
      }),
      myList: s.myList.filter((t) => t.id !== id),
    }));
    await get().loadDetail(id);
    await get().loadList();
  },

  applyServerState(data) {
    const normalized = { ...data, serverNow: data.serverNow || new Date().toISOString() };
    // #region agent log
    tournamentDebugLog(
      'tournamentsStore.ts:applyServerState',
      'tournament state pushed',
      {
        tournamentId: normalized.id,
        status: normalized.status,
        myActiveMatch: normalized.myActiveMatch ?? null,
        registrationStatus: normalized.myRegistration?.status ?? null,
      },
      'H3',
    );
    // #endregion
    if (isMyUpcomingTournament(normalized)) trackRegisteredTournament(normalized.id);
    set((s) => ({
      detail:
        s.detail?.id === normalized.id
          ? {
              ...s.detail,
              ...normalized,
              myRegistration: normalized.myRegistration ?? s.detail.myRegistration ?? null,
              myActiveMatch: normalized.myActiveMatch ?? null,
            }
          : s.detail,
      list: patchListItem(s.list, normalized.id, {
        ...normalized,
        myRegistration: normalized.myRegistration ?? s.list.find((t) => t.id === normalized.id)?.myRegistration ?? null,
        myActiveMatch: normalized.myActiveMatch ?? null,
      }),
      myList: isMyUpcomingTournament(normalized)
        ? mergeMyList(s.myList, [{
            ...normalized,
            myRegistration: normalized.myRegistration ?? { status: 'registered' },
            myActiveMatch: normalized.myActiveMatch ?? null,
          }])
        : s.myList.filter((t) => t.id !== normalized.id),
      matchRoomsById: {
        ...s.matchRoomsById,
        [normalized.id]: resolveJoinRoomId(normalized),
      },
    }));
  },

  connectSocket(id) {
    if (socketManager && get().lobbyTournamentId === id) return;
    get().disconnectSocket();
    set({ lobbyTournamentId: id });
    socketManager = new TournamentSocketManager();
    socketManager.setOnPayload((raw) => {
      const json = raw as { event?: string; data?: TournamentSummary };
      if (json?.event === 'tournament:bracketUpdated') {
        void get().loadBracket(id);
        void get().loadDetail(id);
        return;
      }
      if (json?.event === 'tournament:state' && json?.data) {
        get().applyServerState(json.data);
      }
    });
    socketManager.setOnProxyReconnected(() => {
      socketManager?.requestState();
      void get().loadDetail(id);
      void get().loadBracket(id);
    });
    socketManager.connect(id);
  },

  disconnectSocket() {
    socketManager?.disconnect();
    socketManager = null;
    set({ lobbyTournamentId: null });
  },

  async refreshMyTournaments(userId?: string) {
    let mine: TournamentSummary[] = [];
    try {
      mine = await apiRepository.getMyTournaments();
    } catch {
      /* endpoint may be unavailable on older API builds */
    }

    if (mine.length === 0 && userId) {
      const fromTracked = await hydrateTrackedDetails(userId);
      mine = fromTracked.length > 0 ? fromTracked : get().list.filter(isMyUpcomingTournament);
    }

    if (mine.length === 0) {
      await get().loadList();
      mine = get().list.filter(isMyUpcomingTournament);
    }

    for (const t of mine) trackRegisteredTournament(t.id);
    set({ myList: mine, list: mergeMyList(get().list, mine) });

    await Promise.all(
      mine
        .filter((t) =>
          ['running', 'between_rounds', 'finals_running', 'finals_pending', 'locking', 'countdown'].includes(
            t.status,
          ),
        )
        .map(async (t) => {
          await get().loadDetail(t.id);
          const fresh = get().myList.find((x) => x.id === t.id) ?? get().detail;
          set((s) => ({
            matchRoomsById: {
              ...s.matchRoomsById,
              [t.id]: fresh?.id === t.id ? resolveJoinRoomId(fresh) : resolveJoinRoomId(t),
            },
          }));
        }),
    );
  },
}));
