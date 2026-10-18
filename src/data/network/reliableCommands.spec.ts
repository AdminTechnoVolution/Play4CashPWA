import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { attachReliableCommands } from './reliableCommands';
vi.mock('../auth/AuthSessionStore', () => ({ getUserAccount: () => ({ id: 'fixture-player' }) }));
function fixture() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();
  const sent: Array<{ event: string; payload: any }> = [];
  const socket: any = {
    connected: true,
    emit(event: string, payload: any) { sent.push({ event, payload }); return socket; },
    on(event: string, listener: (...args: any[]) => void) { listeners.set(event, [...listeners.get(event) ?? [], listener]); return socket; },
    off() { listeners.clear(); return socket; },
  };
  const receive = (event: string, payload: any) => listeners.get(event)?.forEach(listener => listener(payload));
  return { socket: socket as Socket, sent, receive };
}
describe('recoverable browser commands', () => {
  beforeEach(() => { vi.stubEnv('VITE_RELIABLE_COMMANDS', 'true'); vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it('keeps one pending move until a committed acknowledgement arrives', () => {
    const { socket, sent, receive } = fixture();
    const cleanup = attachReliableCommands(socket, '/chess', vi.fn());
    receive('command_state', { roomId: 'room-a', version: 4 });
    socket.emit('move', { room_id: 'room-a', from: 'e2', to: 'e4' });
    socket.emit('move', { room_id: 'room-a', from: 'd2', to: 'd4' });
    const moves = sent.filter(p => p.event === 'move'); expect(moves).toHaveLength(1);
    expect(moves[0].payload.expectedVersion).toBe(4);
    expect(JSON.parse(localStorage.getItem('p4c:commands:fixture-player:/chess')!)).toHaveLength(1);
    receive('command_ack', { commandId: moves[0].payload.commandId, roomId: 'room-a', status: 'accepted', version: 5 });
    expect(JSON.parse(localStorage.getItem('p4c:commands:fixture-player:/chess')!)).toEqual([]);
    cleanup?.();
  });
  it('retries the same identifier and content after a lost acknowledgement', () => {
    const { socket, sent, receive } = fixture();
    const cleanup = attachReliableCommands(socket, '/chess', vi.fn());
    receive('command_state', { roomId: 'room-a', version: 4 });
    socket.emit('move', { room_id: 'room-a', from: 'e2', to: 'e4' });
    const original = sent.find(p => p.event === 'move')!.payload;
    receive('command_ack', { commandId: original.commandId, roomId: 'room-a', status: 'unknown', version: 4 });
    expect(sent.filter(p => p.event === 'move').map(p => p.payload)).toEqual([original, original]);
    cleanup?.();
  });
  it('does not replay an obsolete move as a new action', () => {
    const { socket, sent, receive } = fixture(); const resync = vi.fn();
    const cleanup = attachReliableCommands(socket, '/chess', resync);
    socket.emit('join', { room_id: 'room-a' });
    receive('command_state', { roomId: 'room-a', version: 4 });
    socket.emit('move', { room_id: 'room-a', from: 'e2', to: 'e4' });
    const original = sent.find(p => p.event === 'move')!.payload;
    receive('command_ack', { commandId: original.commandId, roomId: 'room-a', status: 'unknown', version: 5 });
    expect(sent.filter(p => p.event === 'move')).toHaveLength(1);
    expect(resync).toHaveBeenCalledOnce(); cleanup?.();
  });
  it('filters old snapshots and releases polling even after all socket listeners are removed', () => {
    const { socket, receive } = fixture(); const resync = vi.fn(); const apply = vi.fn();
    const cleanup = attachReliableCommands(socket, '/chess', resync);
    socket.on('chess', apply);
    receive('chess', { data: { roomId: 'room-a', stateVersion: 4 } });
    receive('chess', { data: { roomId: 'room-a', stateVersion: 3 } });
    receive('chess', { data: { roomId: 'room-a', stateVersion: 6 } });
    expect(apply).toHaveBeenCalledTimes(2); expect(resync).toHaveBeenCalledOnce();
    const beforeCleanup = vi.getTimerCount();
    socket.off(); cleanup?.(); expect(vi.getTimerCount()).toBe(beforeCleanup - 1);
  });
  it('clears a leftover command from another room without alarming or resyncing the current match', () => {
    localStorage.setItem('p4c:commands:fixture-player:/chess', JSON.stringify([
      { commandId: 'old-command', roomId: 'room-old', event: 'move', payload: { room_id: 'room-old' }, expectedVersion: 2 },
    ]));
    const notices: any[] = [];
    const listen = (event: Event) => notices.push((event as CustomEvent).detail);
    window.addEventListener('p4c:command-pending', listen);
    const { socket, sent, receive } = fixture(); const resync = vi.fn();
    const cleanup = attachReliableCommands(socket, '/chess', resync);
    socket.emit('join', { room_id: 'room-new' });
    expect(sent.filter(p => p.event === 'command_status').map(p => p.payload.commandId)).toEqual(['old-command']);
    receive('command_ack', { commandId: 'old-command', roomId: 'room-old', status: 'rejected', reason: 'MATCH_NOT_ACTIVE', version: 3 });
    expect(JSON.parse(localStorage.getItem('p4c:commands:fixture-player:/chess')!)).toEqual([]);
    expect(resync).not.toHaveBeenCalled();
    expect(notices[notices.length - 1]).toEqual({ namespace: '/chess', count: 0, reason: undefined });
    vi.advanceTimersByTime(10_000);
    expect(sent.filter(p => p.event === 'command_status')).toHaveLength(1);
    window.removeEventListener('p4c:command-pending', listen);
    cleanup?.();
  });
  it('applies a queued snapshot older than the live revision reported by command_state', () => {
    const { socket, sent, receive } = fixture(); const apply = vi.fn();
    const cleanup = attachReliableCommands(socket, '/uno', vi.fn());
    socket.on('uno', apply);
    socket.emit('join', { room_id: 'room-a' });
    // A REST ready committed revisions 2 and 3 before the start snapshot (revision 1) left the outbox.
    receive('command_state', { roomId: 'room-a', version: 3 });
    receive('uno', { data: { roomId: 'room-a', stateVersion: 1, gameStarted: true, hand: [] } });
    expect(apply).toHaveBeenCalledOnce();
    receive('uno', { data: { roomId: 'room-a', stateVersion: 0 } });
    expect(apply).toHaveBeenCalledOnce();
    // Commands still expect the live revision, not the older snapshot's.
    socket.emit('draw_one', { room_id: 'room-a' });
    expect(sent.find(p => p.event === 'draw_one')!.payload.expectedVersion).toBe(3);
    cleanup?.();
  });
  it('takes the revision advanced by the start barrier from match_start_state', () => {
    const { socket, sent, receive } = fixture();
    const cleanup = attachReliableCommands(socket, '/chess', vi.fn());
    socket.emit('join', { room_id: 'room-a' });
    receive('command_state', { roomId: 'room-a', version: 4 });
    receive('match_start_state', { roomId: 'room-a', phase: 'active', version: 5 });
    socket.emit('move', { room_id: 'room-a', from: 'e2', to: 'e4' });
    expect(sent.find(p => p.event === 'move')!.payload.expectedVersion).toBe(5);
    cleanup?.();
  });
});
