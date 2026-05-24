import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import type { TournamentBracketResponse, TournamentSummary } from '../data/models/ApiModels';
import { TournamentSocketManager } from '../data/network/TournamentSocketManager';
import { isMyUpcomingTournament } from '../util/tournamentUtils';

interface TournamentsStore {
  list: TournamentSummary[];
  detail: TournamentSummary | null;
  bracket: TournamentBracketResponse | null;
  bracketsById: Record<string, TournamentBracketResponse>;
  matchRoomsById: Record<string, string | null>;
  loading: boolean;
  error: string | null;
  clockTick: number;
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
  refreshMyTournaments: (userId: string) => Promise<void>;
}

let socketManager: TournamentSocketManager | null = null;

function serverOffsetMs(serverNow: string): number {
  return Date.parse(serverNow) - Date.now();
}

export function officialRemainingMs(t: TournamentSummary): number {
  const offset = serverOffsetMs(t.serverNow);
  const now = Date.now() + offset;
  const starts = Date.parse(t.startsAt);
  return Math.max(0, starts - now);
}

function patchListItem(list: TournamentSummary[], id: string, patch: Partial<TournamentSummary>): TournamentSummary[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export const useTournamentsStore = create<TournamentsStore>((set, get) => ({
  list: [],
  detail: null,
  bracket: null,
  bracketsById: {},
  matchRoomsById: {},
  loading: false,
  error: null,
  clockTick: 0,

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
      set((s) => ({
        detail,
        loading: false,
        list: patchListItem(s.list, id, detail),
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

  async loadMatchRoom(tournamentId, userId) {
    const cached = get().matchRoomsById[tournamentId];
    if (cached) return cached;

    const bracket = get().bracketsById[tournamentId] ?? (await get().loadBracket(tournamentId));
    if (!bracket) return null;
    const all = [...bracket.groupMatches, ...bracket.finalsMatches];
    const mine = all.find(
      (m) =>
        (m.playerA?.userId === userId || m.playerB?.userId === userId) &&
        m.roomId &&
        ['ready', 'started', 'waiting_presence'].includes(m.status),
    );
    const roomId = mine?.roomId ?? null;
    set((s) => ({
      matchRoomsById: { ...s.matchRoomsById, [tournamentId]: roomId },
    }));
    return roomId;
  },

  async register(id) {
    await apiRepository.registerTournament(id);
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
      return {
        detail,
        list: patchListItem(s.list, id, {
          myRegistration: reg,
          registeredCount: Math.min(
            s.list.find((t) => t.id === id)?.maxPlayers ?? 0,
            (s.list.find((t) => t.id === id)?.registeredCount ?? 0) + 1,
          ),
        }),
      };
    });
    await get().loadDetail(id);
    await get().loadList();
  },

  async unregister(id) {
    await apiRepository.unregisterTournament(id);
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
    }));
    await get().loadDetail(id);
    await get().loadList();
  },

  applyServerState(data) {
    set((s) => ({
      detail: s.detail?.id === data.id ? { ...s.detail, ...data, myRegistration: data.myRegistration ?? s.detail.myRegistration } : s.detail,
      list: patchListItem(s.list, data.id, {
        ...data,
        myRegistration: data.myRegistration ?? s.list.find((t) => t.id === data.id)?.myRegistration,
      }),
    }));
  },

  connectSocket(id) {
    get().disconnectSocket();
    socketManager = new TournamentSocketManager();
    socketManager.setOnPayload((raw) => {
      const json = raw as { data?: TournamentSummary };
      if (json?.data) get().applyServerState(json.data);
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
  },

  async refreshMyTournaments(userId) {
    await get().loadList();
    const mine = get().list.filter(isMyUpcomingTournament);
    await Promise.all(
      mine
        .filter((t) =>
          ['running', 'between_rounds', 'finals_running', 'finals_pending', 'locking', 'countdown'].includes(
            t.status,
          ),
        )
        .map(async (t) => {
          await get().loadBracket(t.id);
          const bracket = get().bracketsById[t.id];
          if (!bracket) return;
          const all = [...bracket.groupMatches, ...bracket.finalsMatches];
          const match = all.find(
            (m) =>
              (m.playerA?.userId === userId || m.playerB?.userId === userId) &&
              m.roomId &&
              ['ready', 'started', 'waiting_presence'].includes(m.status),
          );
          set((s) => ({
            matchRoomsById: { ...s.matchRoomsById, [t.id]: match?.roomId ?? null },
          }));
        }),
    );
  },
}));
