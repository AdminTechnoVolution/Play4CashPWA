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
