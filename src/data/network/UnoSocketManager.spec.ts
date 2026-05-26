import { describe, expect, it, vi, beforeEach } from 'vitest';

// io() is heavy and pulls in real network. We capture every emit on a single fake socket.
const fakeSocket: {
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
} = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  default: vi.fn(() => fakeSocket),
  io: vi.fn(() => fakeSocket),
}));

vi.mock('../auth/AuthSessionStore', () => ({
  getAccessToken: () => 'tok-XYZ',
  getLanguage: () => 'es',
}));

vi.mock('./socketExtraHeaders', () => ({
  socketIoExtraHeaders: () => ({}),
}));

vi.mock('./socketSessionRefresh', () => ({
  isSocketUnauthorizedConnectError: () => false,
  refreshSocketHandshake: vi.fn(),
}));

vi.mock('./socketVersionListener', () => ({
  attachVersionMismatchListener: vi.fn(),
}));

vi.mock('./socketRegistry', () => ({
  instrumentSocket: vi.fn(),
  releaseSocket: vi.fn(),
}));

import { UnoSocketManager } from './UnoSocketManager';

describe('UnoSocketManager', () => {
  beforeEach(() => {
    fakeSocket.emit.mockClear();
    fakeSocket.on.mockClear();
    fakeSocket.off.mockClear();
    fakeSocket.connect.mockClear();
    fakeSocket.disconnect.mockClear();
  });

  function connected(): UnoSocketManager {
    const mgr = new UnoSocketManager();
    mgr.connect('room-1');
    return mgr;
  }

  it('emits play_card with index and chosen color when wild', () => {
    const mgr = connected();
    mgr.playCard('room-1', 3, { chosenColor: 'B', callUno: true });
    expect(fakeSocket.emit).toHaveBeenCalledWith('play_card', {
      room_id: 'room-1',
      card_index: 3,
      chosen_color: 'B',
      call_uno: true,
    });
  });

  it('emits play_card without optional fields for normal plays', () => {
    const mgr = connected();
    mgr.playCard('room-1', 2);
    expect(fakeSocket.emit).toHaveBeenCalledWith('play_card', {
      room_id: 'room-1',
      card_index: 2,
    });
  });

  it('emits draw_one / pass / take_draw_stack with room_id', () => {
    const mgr = connected();
    mgr.drawCard('r1');
    mgr.passTurn('r1');
    mgr.takeDrawStack('r1');
    expect(fakeSocket.emit).toHaveBeenCalledWith('draw_one', { room_id: 'r1' });
    expect(fakeSocket.emit).toHaveBeenCalledWith('pass', { room_id: 'r1' });
    expect(fakeSocket.emit).toHaveBeenCalledWith('take_draw_stack', { room_id: 'r1' });
  });

  it('emits call_uno with room_id only', () => {
    const mgr = connected();
    mgr.callUno('r1');
    expect(fakeSocket.emit).toHaveBeenCalledWith('call_uno', { room_id: 'r1' });
  });

  it('emits challenge_uno_miss with offender_id', () => {
    const mgr = connected();
    mgr.challengeUnoMiss('r1', 'opponent-7');
    expect(fakeSocket.emit).toHaveBeenCalledWith('challenge_uno_miss', {
      room_id: 'r1',
      offender_id: 'opponent-7',
    });
  });

  it('disconnect tears down the socket reference', () => {
    const mgr = connected();
    mgr.disconnect();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
    // Subsequent emits should be no-ops because socket reference is null.
    fakeSocket.emit.mockClear();
    mgr.callUno('r1');
    expect(fakeSocket.emit).not.toHaveBeenCalled();
  });
});
