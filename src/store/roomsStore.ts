import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import type { RoomResponse, CreateRoomRequest } from '../data/models/ApiModels';

interface RoomsState {
  rooms: RoomResponse[];
  isLoading: boolean;
  error: string | null;
  showCreateDialog: boolean;
  currentGameId: string | null;
  loadRooms: (gameId: string) => Promise<void>;
  createRoom: (req: CreateRoomRequest) => Promise<string>;
  joinRoom: (id: string) => Promise<void>;
  spectateRoom: (id: string) => Promise<void>;
  setShowCreateDialog: (v: boolean) => void;
  // Called directly by RoomsPage socket handlers
  addOrUpdateRoom: (room: RoomResponse) => void;
  updateRoom: (room: RoomResponse) => void;
  removeRoom: (roomId: string) => void;
  clearError: () => void;
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  isLoading: false,
  error: null,
  showCreateDialog: false,
  currentGameId: null,

  loadRooms: async (gameId: string) => {
    set({ isLoading: true, error: null, currentGameId: gameId });
    try {
      const rooms = await apiRepository.getRooms(gameId);
      set({ rooms, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load rooms.';
      set({ isLoading: false, error: msg });
    }
  },

  createRoom: async (req: CreateRoomRequest) => {
    return apiRepository.createRoom(req);
  },

  joinRoom: async (id: string) => {
    return apiRepository.joinRoom(id);
  },

  spectateRoom: async (id: string) => {
    return apiRepository.spectateRoom(id);
  },

  setShowCreateDialog: (v: boolean) => set({ showCreateDialog: v }),

  addOrUpdateRoom: (room: RoomResponse) =>
    set((state) => ({
      rooms: [room, ...state.rooms.filter((r) => r.id !== room.id)],
    })),

  updateRoom: (room: RoomResponse) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
    })),

  removeRoom: (roomId: string) =>
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
    })),

  clearError: () => set({ error: null }),
}));
