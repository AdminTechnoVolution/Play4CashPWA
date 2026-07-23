import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRoomState: vi.fn(),
  roomReady: vi.fn(),
  resync: vi.fn(),
  handleRoomGone: vi.fn(),
  savePlayContext: vi.fn(),
  lobbyConnect: vi.fn(),
  lobbyDisconnect: vi.fn(),
  lobbyOffAll: vi.fn(),
  requestRoomState: vi.fn(),
  onConnect: undefined as undefined | (() => void),
  onRoomUpdated: undefined as undefined | ((room: { id: string }) => void),
  onRoomStarted: undefined as undefined | ((room: { id: string }) => void),
  onRoomState: undefined as undefined | ((state: any) => void),
  onRoomStateError: undefined as undefined | ((reason: 'invalid' | 'notFound') => void),
}));

vi.mock('../data/network/ApiRepository', () => ({
  apiRepository: {
    getRoomState: mocks.getRoomState,
    roomReady: mocks.roomReady,
  },
}));

vi.mock('../util/playRoomSession', () => ({
  resyncActivePlaySession: mocks.resync,
  handleRoomGone: mocks.handleRoomGone,
}));

vi.mock('../util/routingStorage', () => ({
  getPlayContext: () => ({
    roomId: 'room-1',
    betAmount: 10,
    roomName: 'Room',
    opponentName: 'Waiting',
    hasOpponent: false,
    isSpectator: false,
    isPlayer1: true,
  }),
  getGameContext: () => ({ gameId: 'game-1', gameName: 'Chess' }),
  savePlayContext: mocks.savePlayContext,
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ user: { id: 'player-1' } }),
  },
}));

vi.mock('../data/network/LobbySocketManager', () => ({
  LobbySocketManager: class {
    connect(gameId: string, roomId?: string) { mocks.lobbyConnect(gameId, roomId); }
    disconnect() { mocks.lobbyDisconnect(); }
    offAll() { mocks.lobbyOffAll(); }
    requestRoomState(roomId: string) { mocks.requestRoomState(roomId); }
    onConnect(cb: () => void) { mocks.onConnect = cb; }
    onRoomUpdated(cb: (room: { id: string }) => void) { mocks.onRoomUpdated = cb; }
    onRoomStarted(cb: (room: { id: string }) => void) { mocks.onRoomStarted = cb; }
    onRoomState(cb: (state: any) => void) { mocks.onRoomState = cb; }
    onRoomStateError(cb: (reason: 'invalid' | 'notFound') => void) {
      mocks.onRoomStateError = cb;
    }
  },
}));

import { ChessPhase, useChessStore } from '../store/chessStore';
import { useWaitingRoomStartSync } from './useWaitingRoomStartSync';

const startedState = {
  roomId: 'room-1',
  gameId: 'game-1',
  gameSocketCode: 'chess',
  status: 'started',
  players: [
    { id: 'player-1', username: 'Creator' },
    { id: 'player-2', username: 'Joiner' },
  ],
  currentPlayers: 2,
  requiredPlayers: 2,
  isCurrentUserInRoom: true,
  canEnterPlay: true,
  playPath: '/play/chess',
  betAmount: 10,
  roomName: 'Room',
  updatedAt: '2026-07-23T12:00:00.000Z',
  startedAt: '2026-07-23T12:00:00.000Z',
};

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useWaitingRoomStartSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.onConnect = undefined;
    mocks.onRoomUpdated = undefined;
    mocks.onRoomStarted = undefined;
    mocks.onRoomState = undefined;
    mocks.onRoomStateError = undefined;
    mocks.getRoomState.mockResolvedValue(startedState);
    mocks.roomReady.mockResolvedValue(undefined);
    mocks.resync.mockResolvedValue(undefined);
    useChessStore.setState({ phase: ChessPhase.WAITING });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('processes authoritative state delivered by the room socket', async () => {
    renderHook(() => useWaitingRoomStartSync('chess', 'room-1', false));
    mocks.onRoomState?.(startedState);
    await flushAsyncWork();

    expect(mocks.lobbyConnect).toHaveBeenCalledWith('game-1', 'room-1');
    expect(mocks.getRoomState).not.toHaveBeenCalled();
    expect(mocks.roomReady).toHaveBeenCalledWith('room-1');
    expect(mocks.resync).toHaveBeenCalled();
    expect(mocks.savePlayContext).toHaveBeenCalledWith(
      expect.objectContaining({ hasOpponent: true, opponentName: 'Joiner' }),
    );
  });

  it('requests state on visibility and socket resync', async () => {
    renderHook(() => useWaitingRoomStartSync('chess', 'room-1', false));
    await flushAsyncWork();
    mocks.requestRoomState.mockClear();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsyncWork();
    expect(mocks.requestRoomState).toHaveBeenCalledWith('room-1');

    mocks.requestRoomState.mockClear();
    window.dispatchEvent(
      new CustomEvent('p4c:socket-resync', { detail: { namespace: '/rooms' } }),
    );
    await flushAsyncWork();
    expect(mocks.requestRoomState).toHaveBeenCalledWith('room-1');
  });

  it('does not create a polling loop and cleans up on unmount', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const { rerender, unmount } = renderHook(() =>
      useWaitingRoomStartSync('chess', 'room-1', false),
    );
    await flushAsyncWork();

    rerender();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(mocks.getRoomState).not.toHaveBeenCalled();

    unmount();
    expect(mocks.lobbyOffAll).toHaveBeenCalled();
    expect(mocks.lobbyDisconnect).toHaveBeenCalled();
  });

  it('does not enter play when the authenticated user is not in the room', async () => {
    mocks.getRoomState.mockResolvedValue({
      ...startedState,
      isCurrentUserInRoom: false,
      canEnterPlay: false,
    });

    renderHook(() => useWaitingRoomStartSync('chess', 'room-1', false));
    mocks.onRoomState?.({
      ...startedState,
      isCurrentUserInRoom: false,
      canEnterPlay: false,
    });
    await flushAsyncWork();

    expect(mocks.handleRoomGone).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'room-1', reason: 'inactive' }),
    );
    expect(mocks.resync).not.toHaveBeenCalled();
  });

  it('leaves play when socket synchronization reports a deleted room', async () => {
    renderHook(() => useWaitingRoomStartSync('chess', 'room-1', false));

    mocks.onRoomStateError?.('notFound');

    expect(mocks.handleRoomGone).toHaveBeenCalledWith({
      reason: 'notFound',
      gameSocketCode: 'chess',
      roomId: 'room-1',
    });
  });
});
