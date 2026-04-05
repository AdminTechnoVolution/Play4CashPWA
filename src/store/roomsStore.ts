import { create } from 'zustand';
import { apiRepository } from '../data/network/ApiRepository';
import { LobbySocketManager } from '../data/network/LobbySocketManager';
import type { RoomResponse, CreateRoomRequest } from '../data/models/ApiModels';

const lobbySocket = new LobbySocketManager();

interface RoomsState {
  rooms: RoomResponse[];
  isLoading: boolean;
  error: string | null;
  showCreateDialog: boolean;
  currentGameId: string | null;
  loadRooms: (gameId: string) => Promise<void>;
  createRoom: (req: CreateRoomRequest) => Promise<RoomResponse>;
  joinRoom: (id: string) => Promise<RoomResponse>;
  spectateRoom: (id: string) => Promise<RoomResponse>;
  setShowCreateDialog: (v: boolean) => void;
  connectSocket: (gameId: string) => void;
  disconnectSocket: () => void;
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
    const room = await apiRepository.createRoom(req);
    set((state) => ({
      rooms: [room, ...state.rooms.filter((r) => r.id !== room.id)],
    }));
    return room;
  },

  joinRoom: async (id: string) => {
    return apiRepository.joinRoom(id);
  },

  spectateRoom: async (id: string) => {
    return apiRepository.spectateRoom(id);
  },

  setShowCreateDialog: (v: boolean) => set({ showCreateDialog: v }),

  connectSocket: (gameId: string) => {
    lobbySocket.connect();

    lobbySocket.onRoomCreated((room: RoomResponse) => {
      if (room.gameId !== gameId) return;
      set((state) => ({
        rooms: [room, ...state.rooms.filter((r) => r.id !== room.id)],
      }));
    });

    lobbySocket.onRoomUpdated((room: RoomResponse) => {
      if (room.gameId !== gameId) return;
      set((state) => ({
        rooms: state.rooms.map((r) => (r.id === room.id ? room : r)),
      }));
    });

    lobbySocket.onRoomDeleted((roomId: string) => {
      set((state) => ({
        rooms: state.rooms.filter((r) => r.id !== roomId),
      }));
    });
  },

  disconnectSocket: () => {
    lobbySocket.offAll();
    lobbySocket.disconnect();
  },

  clearError: () => set({ error: null }),
}));
