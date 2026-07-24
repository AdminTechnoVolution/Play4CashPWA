import { describe, expect, it, vi } from 'vitest';
import { emitSocketResync } from './socketResync';

describe('emitSocketResync', () => {
  it('does not let a stale socket throttle the first recovery request on its replacement', () => {
    const oldSocket = { connected: true, emit: vi.fn(), on: vi.fn() } as any;
    const replacementSocket = { connected: true, emit: vi.fn(), on: vi.fn() } as any;

    emitSocketResync(oldSocket, '/domino', 'room-started');
    emitSocketResync(replacementSocket, '/domino', 'room-started');

    expect(oldSocket.emit).toHaveBeenCalledWith('get_state', { room_id: 'room-started' });
    expect(replacementSocket.emit).toHaveBeenCalledWith('get_state', { room_id: 'room-started' });
  });

  it('queues the latest state request until a disconnected socket reconnects', () => {
    let onConnect: (() => void) | undefined;
    const socket = {
      connected: false,
      emit: vi.fn(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'connect') onConnect = cb;
      }),
    } as any;

    emitSocketResync(socket, '/domino', 'room-old');
    emitSocketResync(socket, '/domino', 'room-started');
    expect(socket.emit).not.toHaveBeenCalled();

    socket.connected = true;
    onConnect?.();

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('get_state', { room_id: 'room-started' });
  });
});
