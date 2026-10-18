import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socket = vi.hoisted(() => ({ deliver: (_raw: unknown) => {} }));
vi.mock('../data/network/BattleshipSocketManager', () => ({
  BattleshipSocketManager: class {
    connect = vi.fn(); disconnect = vi.fn(); requestSync = vi.fn(); fire = vi.fn(); offAll = vi.fn();
    onGameUpdate(cb: (raw: unknown) => void) { socket.deliver = cb; }
  },
}));
const deliver = (raw: unknown) => socket.deliver(raw);

import { useBattleshipStore } from './battleshipStore';

const fleet = [
  { type: 'carrier', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { type: 'destroyer', cells: [[8, 0], [8, 1]] },
];

describe('battleship store sync', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { useBattleshipStore.getState().cleanup?.(); vi.useRealTimers(); });

  it('applies the start snapshot when its history also lists fleet placements', () => {
    useBattleshipStore.getState().initGame('room-1', 'alice', true, 'bob', false);
    expect(() => deliver({ success: true, messages: [], data: {
      gameStarted: true, yourTurn: true, player1: 'alice', player2: 'bob', ships: fleet,
      history: [{ type: 'placement', player: 'alice' }, { type: 'placement', player: 'bob' }, { row: 3, col: 4, outcome: 'miss', player: 'bob' }],
    } })).not.toThrow();
    const state = useBattleshipStore.getState();
    expect(state.phase).toBe('battle');
    expect(state.isMyTurn).toBe(true);
    expect(state.playerBoard[0][0]).toBe('ship');
    expect(state.playerBoard[3][4]).toBe('miss');
  });

  it('puts each shot on the board the server names, even after a resync cleared the pending-fire flag', () => {
    useBattleshipStore.getState().initGame('room-1', 'alice', true, 'bob', false);
    deliver({ success: true, messages: [], data: { gameStarted: true, yourTurn: true, player1: 'alice', player2: 'bob', ships: fleet, history: [] } });
    useBattleshipStore.setState({ hasPendingFire: false });

    deliver({ success: true, messages: [], data: { outcome: 'miss', row: 9, col: 0, yourTurn: false, yourShot: true } });
    expect(useBattleshipStore.getState().opponentBoard[9][0]).toBe('miss');
    expect(useBattleshipStore.getState().playerBoard[9][0]).not.toBe('miss');

    vi.advanceTimersByTime(3000);
    deliver({ success: true, messages: [], data: { outcome: 'miss', row: 9, col: 0, yourTurn: true, yourShot: false } });
    expect(useBattleshipStore.getState().playerBoard[9][0]).toBe('miss');
  });

  it('enables fleet confirmation from its own sync when the opponent is already seated, without a join toast', () => {
    useBattleshipStore.getState().initGame('room-1', 'alice', false, '', false);
    expect(useBattleshipStore.getState().opponentConfirmed).toBe(false);
    deliver({ success: true, messages: [], data: { waitingForOpponent: true, isSpectator: false, opponentPresent: true, opponentName: 'bob' } });
    const state = useBattleshipStore.getState();
    expect(state.opponentConfirmed).toBe(true);
    expect(state.opponentName).toBe('bob');
    expect(state.opponentJoinedToast).toBeNull();
    expect(state.phase).toBe('placement');
  });
});
