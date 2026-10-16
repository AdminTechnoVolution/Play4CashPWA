import type { Socket } from 'socket.io-client';
import { getUserAccount } from '../auth/AuthSessionStore';

const MUTATIONS = new Set(['move', 'drop_disc', 'end_turn', 'forfeit', 'place_ships', 'fire', 'draw', 'pass',
  'play_card', 'call_uno', 'challenge_uno_miss', 'start_next_round', 'take_draw_stack', 'draw_one']);
export interface PendingCommand { commandId: string; roomId: string; event: string; payload: Record<string, unknown>; expectedVersion: number }
export function canRetryCommand(command: PendingCommand, version: number): boolean { return command.expectedVersion === version; }
export function attachReliableCommands(socket: Socket, namespace: string, resync: () => void): (() => void) | undefined {
  if (import.meta.env.VITE_RELIABLE_COMMANDS !== 'true' || !['/chess', '/domino', '/halma', '/uno', '/naval-battle', '/connect-four'].includes(namespace)) return;
  const actor = getUserAccount()?.id;
  if (!actor) return;
  const auth = socket.auth;
  socket.auth = typeof auth === 'function' ? callback => auth(payload => callback({ ...payload, commandProtocol: '1' })) : { ...auth, commandProtocol: '1' };
  const key = `p4c:commands:${actor}:${namespace}`;
  const versions = new Map<string, number>();
  const pending = new Map<string, PendingCommand>();
  try {
    const saved: PendingCommand[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(saved)) for (const command of saved.slice(0, 32)) {
      if (command.commandId && command.roomId && MUTATIONS.has(command.event)) pending.set(command.commandId, command);
    }
  } catch { /* Corrupt browser data cannot determine server state. */ }
  const publish = (reason?: string) => {
    localStorage.setItem(key, JSON.stringify([...pending.values()]));
    window.dispatchEvent(new CustomEvent('p4c:command-pending', { detail: { namespace, count: pending.size, reason } }));
  };
  const send = socket.emit.bind(socket);
  socket.emit = ((event: string, ...args: unknown[]) => {
    if (event === 'join' && args[0] && typeof args[0] === 'object') {
      const roomId = (args[0] as Record<string, unknown>).room_id;
      if (typeof roomId === 'string') send('command_state', { roomId });
    }
    if (!MUTATIONS.has(event)) return send(event, ...args);
    const payload = args[0] as Record<string, unknown> | undefined;
    const roomId = String(payload?.room_id ?? payload?.roomId ?? '');
    if (!roomId || !socket.connected || !versions.has(roomId)) { publish('Esperando el estado de la partida.'); resync(); return socket; }
    if ([...pending.values()].some(c => c.roomId === roomId)) { publish('Hay una jugada pendiente de confirmar.'); return socket; }
    const command: PendingCommand = { commandId: crypto.randomUUID(), roomId, event,
      payload: { ...payload }, expectedVersion: versions.get(roomId)! };
    pending.set(command.commandId, command);
    try { publish(); } catch { pending.delete(command.commandId); throw new Error('No se pudo guardar la jugada pendiente.'); }
    return send(event, { ...command.payload, commandId: command.commandId, expectedVersion: command.expectedVersion });
  }) as Socket['emit'];
  // Filter stale game snapshots before a manager applies them to its store.
  const on = socket.on.bind(socket);
  socket.on = ((event: string, handler: (...args: any[]) => void) => {
    if (event !== namespace.slice(1)) return on(event, handler);
    return on(event, (...args: any[]) => {
      const data = args[0]?.data;
      const roomId = data?.roomId ?? data?.room_id;
      const version = data?.stateVersion;
      if (typeof roomId === 'string' && Number.isSafeInteger(version)) {
        const preceding = versions.get(roomId);
        if (preceding !== undefined && version < preceding) return;
        versions.set(roomId, version);
        if (preceding !== undefined && version > preceding + 1) resync();
      }
      handler(...args);
    });
  }) as Socket['on'];
  on('command_state', (state: { roomId: string; version: number }) => {
    if (Number.isSafeInteger(state.version)) versions.set(state.roomId, state.version);
  });
  on('command_ack', (ack: { commandId: string; roomId: string; status: string; version: number; reason?: string }) => {
    const command = pending.get(ack.commandId);
    if (!command || command.roomId !== ack.roomId) return;
    if (ack.status === 'unknown') {
      if (canRetryCommand(command, ack.version)) {
        send(command.event, { ...command.payload, commandId: command.commandId, expectedVersion: command.expectedVersion });
        return;
      }
      pending.delete(ack.commandId); publish('La jugada no se aplicó; se recuperó el estado actual.'); resync(); return;
    }
    if (!['accepted', 'rejected'].includes(ack.status)) return;
    versions.set(ack.roomId, Math.max(versions.get(ack.roomId) ?? 0, ack.version));
    pending.delete(ack.commandId);
    publish(ack.status === 'rejected' ? 'La jugada fue rechazada; se recuperó el estado actual.' : undefined);
    if (ack.status === 'rejected') resync();
  });
  const recover = () => {
    for (const command of pending.values()) send('command_status', { roomId: command.roomId, commandId: command.commandId });
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  const start = () => { if (timer) clearInterval(timer); recover(); timer = setInterval(recover, 2000); };
  on('connect', start);
  on('proxy_reconnected', recover);
  on('proxy_busy', () => publish('La conexión está ocupada. La jugada sigue pendiente.'));
  on('rate_limited', () => publish('Esperando autorización para recuperar la jugada.'));
  on('disconnect', () => { if (timer) clearInterval(timer); timer = undefined; });
  if (socket.connected) start();
  publish();
  return () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    window.dispatchEvent(new CustomEvent('p4c:command-pending', { detail: { namespace, count: 0 } }));
  };
}
