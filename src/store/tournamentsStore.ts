import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import type { TournamentBracketResponse, TournamentSummary } from '../data/models/ApiModels';
import { TournamentSocketManager } from '../data/network/TournamentSocketManager';

interface TournamentsStore {
  list: TournamentSummary[];
  detail: TournamentSummary | null;
  bracket: TournamentBracketResponse | null;
  loading: boolean;
  error: string | null;
  loadList: () => Promise<void>;
  loadDetail: (id: string) => Promise<void>;
  loadBracket: (id: string) => Promise<void>;
  register: (id: string) => Promise<void>;
  unregister: (id: string) => Promise<void>;
  applyServerState: (data: TournamentSummary) => void;
  connectSocket: (id: string) => void;
  disconnectSocket: () => void;
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

export const useTournamentsStore = create<TournamentsStore>((set, get) => ({
  list: [],
  detail: null,
  bracket: null,
  loading: false,
  error: null,

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
      set({ detail, loading: false });
    } catch {
      set({ loading: false, error: 'tournament_load_error' });
    }
  },

  async loadBracket(id) {
    try {
      const bracket = await apiRepository.getTournamentBracket(id);
      set({ bracket });
    } catch {
      set({ error: 'tournament_bracket_error' });
    }
  },

  async register(id) {
    await apiRepository.registerTournament(id);
    await get().loadDetail(id);
    await get().loadList();
  },

  async unregister(id) {
    await apiRepository.unregisterTournament(id);
    await get().loadDetail(id);
    await get().loadList();
  },

  applyServerState(data) {
    set({ detail: data });
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
    });
    socketManager.connect(id);
  },

  disconnectSocket() {
    socketManager?.disconnect();
    socketManager = null;
  },
}));
