import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const handlers = new Map<string, Array<(...args: any[]) => void>>();
  return {
    handlers,
    socket: {
      connected: false,
      on: vi.fn((event: string, cb: (...args: any[]) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), cb]);
      }),
      emit: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    fire(event: string, payload?: unknown) {
      for (const cb of handlers.get(event) ?? []) cb(payload);
    },
  };
});

vi.mock('socket.io-client', () => ({ default: vi.fn(() => fake.socket) }));
vi.mock('./socketVersionListener', () => ({ attachVersionMismatchListener: vi.fn() }));
vi.mock('./socketRegistry', () => ({
  instrumentSocket: vi.fn(),
  releaseSocket: vi.fn(),
}));
vi.mock('./socketExtraHeaders', () => ({ socketIoExtraHeaders: () => ({}) }));
vi.mock('./socketSessionRefresh', () => ({
  isSocketUnauthorizedConnectError: () => false,
  refreshSocketHandshake: vi.fn(),
}));

import { LobbySocketManager } from './LobbySocketManager';

describe('LobbySocketManager realtime subscription', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.handlers.clear();
    vi.clearAllMocks();
    fake.socket.connected = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps subscribing until the backend confirms the game channel', async () => {
    const manager = new LobbySocketManager();
    manager.connect('game-1');
    fake.socket.connected = true;
    fake.fire('connect');

    expect(fake.socket.emit).toHaveBeenCalledWith('subscribe', { game_id: 'game-1' });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fake.socket.emit).toHaveBeenCalledTimes(2);

    fake.fire('rooms', {
      success: true,
      data: { event: 'subscribed', game_id: 'game-1' },
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fake.socket.emit).toHaveBeenCalledTimes(2);
  });

  it('delivers room creation and join updates when callbacks are set before connect', () => {
    const created = vi.fn();
    const updated = vi.fn();
    const manager = new LobbySocketManager();
    manager.onRoomCreated(created);
    manager.onRoomUpdated(updated);
    manager.connect('game-1');

    const room = {
      _id: 'room-1',
      name: 'Table',
      game_id: 'game-1',
      players: [],
      status: 'waiting',
    };
    fake.fire('roomCreated', room);
    fake.fire('roomUpdated', { ...room, players: [{ playerId: { _id: 'p2', username: 'Ana' } }] });

    expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'room-1' }));
    expect(updated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'room-1', players: [{ id: 'p2', username: 'Ana' }] }),
    );
  });
});
