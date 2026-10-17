import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { attachMatchStart, useMatchStartStore } from './matchStart';
function fixture() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const sent: Array<{ event: string; payload: any }> = [];
  const socket: any = {
    connected: true,
    emit(event: string, payload: any) { sent.push({ event, payload }); return socket; },
    on(event: string, listener: (...args: any[]) => void) { listeners.set(event, [...listeners.get(event) ?? [], listener]); return socket; },
  };
  const receive = (event: string, payload?: any) => listeners.get(event)?.forEach(listener => listener(payload));
  const events = (name: string) => sent.filter(p => p.event === name);
  return { socket: socket as Socket, sent, receive, events };
}
const started = { success: true, data: { gameStarted: true, isSpectator: false, board: [[]] } };
const pending = (roomId: string) => !!useMatchStartStore.getState().pending[roomId];
describe('match start barrier', () => {
  beforeEach(() => { vi.useFakeTimers(); useMatchStartStore.setState({ pending: {} }); });
  afterEach(() => { vi.useRealTimers(); });
  it('acknowledges after the snapshot is applied and opens play when the server countdown ends', () => {
    const { socket, receive, events } = fixture(); const resync = vi.fn(); const order: string[] = [];
    const cleanup = attachMatchStart(socket, '/chess', resync);
    socket.on('chess', () => order.push('applied'));
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', started);
    order.push(...events('initial_state_ack').map(() => 'ack'));
    expect(order).toEqual(['applied', 'ack']);
    expect(events('initial_state_ack')[0].payload).toEqual({ roomId: 'room-a' });
    expect(pending('room-a')).toBe(true);
    socket.emit('move', { room_id: 'room-a' });
    expect(events('move')).toHaveLength(0);
    receive('match_start_state', { roomId: 'room-a', phase: 'active', startsAt: '2026-01-01T00:00:01.500Z', serverNow: '2026-01-01T00:00:00.000Z' });
    vi.advanceTimersByTime(1499);
    expect(pending('room-a')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(pending('room-a')).toBe(false); expect(resync).toHaveBeenCalledOnce();
    socket.emit('move', { room_id: 'room-a' });
    expect(events('move')).toHaveLength(1);
    cleanup?.();
  });
  it('requests the full state instead of acknowledging a start event without private state', () => {
    const { socket, receive, events } = fixture(); const resync = vi.fn();
    const cleanup = attachMatchStart(socket, '/naval-battle', resync);
    socket.on('naval-battle', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('naval-battle', { success: true, data: { gameStarted: true, isSpectator: false } });
    expect(events('initial_state_ack')).toHaveLength(0); expect(resync).toHaveBeenCalledOnce();
    receive('naval-battle', { success: true, data: { gameStarted: true, isSpectator: false, ships: [] } });
    expect(events('initial_state_ack')).toHaveLength(1);
    cleanup?.();
  });
  it('never polls for spectators or players still waiting for an opponent', () => {
    const { socket, receive, events } = fixture(); const resync = vi.fn();
    const cleanup = attachMatchStart(socket, '/chess', resync);
    socket.on('chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', { success: true, data: { room_id: 'room-a', waitingForOpponent: true } });
    receive('chess', { success: true, data: { gameStarted: true, isSpectator: true, board: [[]] } });
    vi.advanceTimersByTime(10_000);
    expect(resync).not.toHaveBeenCalled(); expect(events('initial_state_ack')).toHaveLength(0);
    expect(pending('room-a')).toBe(false);
    cleanup?.();
  });
  it('retries the acknowledgement until the opponent is ready', () => {
    const { socket, receive, events } = fixture();
    const cleanup = attachMatchStart(socket, '/chess', vi.fn());
    socket.on('chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', started);
    receive('match_start_state', { roomId: 'room-a', phase: 'preparing' });
    vi.advanceTimersByTime(4000);
    expect(events('initial_state_ack')).toHaveLength(3);
    cleanup?.();
  });
  it('keeps play open after a reconnect once the match has started', () => {
    const { socket, receive, events } = fixture();
    const cleanup = attachMatchStart(socket, '/chess', vi.fn());
    socket.on('chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', started);
    receive('match_start_state', { roomId: 'room-a', phase: 'legacy' });
    vi.advanceTimersByTime(0);
    receive('disconnect');
    receive('chess', started);
    expect(pending('room-a')).toBe(false);
    socket.emit('move', { room_id: 'room-a' });
    expect(events('move')).toHaveLength(1);
    cleanup?.();
  });
  it('releases the overlay when the server cancels an unconfirmed start', () => {
    const { socket, receive } = fixture();
    const cleanup = attachMatchStart(socket, '/chess', vi.fn());
    socket.on('chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', started);
    receive('chess', { success: true, data: { roomId: 'room-a', gameEnded: true, outcome: 'match_cancelled' } });
    expect(pending('room-a')).toBe(false);
    cleanup?.();
  });
  it('fetches the missed snapshot when the server reports it is still waiting for this player', () => {
    const { socket, receive, events } = fixture(); const resync = vi.fn();
    const cleanup = attachMatchStart(socket, '/uno', resync);
    socket.on('uno', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('uno', { success: true, data: { waitingForOpponent: true } });
    receive('match_start_state', { roomId: 'room-a', phase: 'preparing' });
    expect(resync).toHaveBeenCalledOnce(); expect(pending('room-a')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(resync).toHaveBeenCalledTimes(2);
    receive('uno', { success: true, data: { gameStarted: true, isSpectator: false, hand: [] } });
    expect(events('initial_state_ack')).toHaveLength(1);
    cleanup?.();
  });
  it('asks for the state again when a join is never answered, a bounded number of times', () => {
    const { socket, receive } = fixture(); const resync = vi.fn();
    const cleanup = attachMatchStart(socket, '/uno', resync);
    socket.on('uno', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    vi.advanceTimersByTime(4000);
    expect(resync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(resync).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000);
    expect(resync).toHaveBeenCalledTimes(5);
    socket.emit('join', { room_id: 'room-a' });
    receive('uno', { success: true, data: { waitingForOpponent: true } });
    vi.advanceTimersByTime(60_000);
    expect(resync).toHaveBeenCalledTimes(5);
    cleanup?.();
  });
  it('starts a new room on the same socket after a previous match opened', () => {
    const { socket, receive, events } = fixture();
    const cleanup = attachMatchStart(socket, '/chess', vi.fn());
    socket.on('chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('chess', started);
    receive('match_start_state', { roomId: 'room-a', phase: 'active', startsAt: '2026-01-01T00:00:01Z', serverNow: '2026-01-01T00:00:00Z' });
    socket.emit('join', { room_id: 'room-b' });
    expect(pending('room-a')).toBe(false);
    receive('chess', started);
    receive('match_start_state', { roomId: 'room-b', phase: 'legacy' });
    vi.advanceTimersByTime(0);
    expect(pending('room-b')).toBe(false);
    expect(events('initial_state_ack').map(p => p.payload.roomId)).toEqual(['room-a', 'room-b']);
    cleanup?.();
  });
});
