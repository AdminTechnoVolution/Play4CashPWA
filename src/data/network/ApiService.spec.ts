import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('./ApiClient', () => ({
  apiClient: { post: mocks.post, get: mocks.get, patch: mocks.patch, put: mocks.put, delete: mocks.del },
  bareClient: { post: mocks.post, get: mocks.get, patch: mocks.patch, put: mocks.put, delete: mocks.del },
}));

import { apiService } from './ApiService';

describe('apiService.recharge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the provided idempotency key as a header', async () => {
    mocks.post.mockResolvedValueOnce({ data: { success: true, data: {} } });

    await apiService.recharge({
      txId: 'tx-1',
      coin: 'usdt',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/transactions/recharge',
      {
        txId: 'tx-1',
        coin: 'usdt',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      },
      {
        headers: {
          'Idempotency-Key': '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    );
  });

  it('generates an idempotency key when the caller does not provide one', async () => {
    const randomUUID = vi.fn().mockReturnValue('11111111-2222-4333-8444-555555555555');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });
    mocks.post.mockResolvedValueOnce({ data: { success: true, data: {} } });

    await apiService.recharge({
      txId: 'tx-2',
      coin: 'usdt',
    });

    expect(randomUUID).toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledWith(
      '/api/transactions/recharge',
      {
        txId: 'tx-2',
        coin: 'usdt',
      },
      {
        headers: {
          'Idempotency-Key': '11111111-2222-4333-8444-555555555555',
        },
      },
    );
  });
});

describe('apiService.getGameHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps every opponent from a multiplayer history response', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            room_id: 'room-1',
            opponents: [
              { username: 'Ana' },
              { username: 'Luis' },
              { username: 'Marta' },
            ],
          },
        ],
      },
    });

    const [item] = await apiService.getGameHistory();

    expect(item.opponentNames).toEqual(['Ana', 'Luis', 'Marta']);
  });

  it('falls back to the legacy singular opponent response', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ room_id: 'room-2', opponent: { username: 'LegacyPlayer' } }],
      },
    });

    const [item] = await apiService.getGameHistory();

    expect(item.opponentNames).toEqual(['LegacyPlayer']);
  });
});

describe('apiService authoritative room state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the started state directly from join so navigation need not wait for websocket', async () => {
    mocks.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          roomId: 'room-1',
          gameId: 'game-1',
          gameSocketCode: 'chess',
          status: 'started',
          players: [{ id: 'p1', username: 'A' }, { id: 'p2', username: 'B' }],
          currentPlayers: 2,
          requiredPlayers: 2,
          isCurrentUserInRoom: true,
          canEnterPlay: true,
          playPath: '/play/chess',
        },
      },
    });

    const state = await apiService.joinRoom('room-1');

    expect(mocks.post).toHaveBeenCalledWith('/api/rooms/room-1/join');
    expect(state).toEqual(expect.objectContaining({
      status: 'started',
      gameSocketCode: 'chess',
      canEnterPlay: true,
      currentPlayers: 2,
    }));
  });

  it('normalizes the authenticated HTTP state endpoint', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          room_id: 'room-2',
          game_socket_code: 'uno',
          status: 'waiting',
          players: [{ id: 'p1', username: 'A' }],
          current_players: 1,
          required_players: 4,
          is_current_user_in_room: true,
          can_enter_play: false,
        },
      },
    });

    const state = await apiService.getRoomState('room-2');

    expect(mocks.get).toHaveBeenCalledWith('/api/rooms/room-2/state');
    expect(state).toEqual(expect.objectContaining({
      roomId: 'room-2',
      gameSocketCode: 'uno',
      currentPlayers: 1,
      requiredPlayers: 4,
      canEnterPlay: false,
    }));
  });
});
