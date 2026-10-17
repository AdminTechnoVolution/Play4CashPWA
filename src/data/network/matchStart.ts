import type { Socket } from 'socket.io-client';
import { create } from 'zustand';

export const useMatchStartStore = create<{ pending: Record<string, boolean> }>(() => ({ pending: {} }));
function setPending(roomId: string, pending: boolean) {
  useMatchStartStore.setState(s => {
    const next = { ...s.pending };
    if (pending) next[roomId] = true; else delete next[roomId];
    return { pending: next };
  });
}
const GAMES = new Set(['/chess', '/halma', '/domino', '/uno', '/connect-four', '/naval-battle']);
const ACTIONS = new Set(['move', 'drop_disc', 'end_turn', 'fire', 'draw', 'pass', 'play_card', 'call_uno', 'challenge_uno_miss', 'start_next_round', 'take_draw_stack', 'draw_one']);
const RETRY_MS = 2000;
export function hasInitialState(namespace: string, data: any): boolean {
  if (!data?.gameStarted || data.isSpectator || data.gameEnded) return false;
  if (namespace === '/naval-battle') return Array.isArray(data.ships);
  if (namespace === '/uno' || namespace === '/domino') return Array.isArray(data.hand);
  return Array.isArray(data.board);
}

/** Wrap the game listener so acknowledgement happens only AFTER the store has applied the snapshot. */
export function attachMatchStart(socket: Socket, namespace: string, resync: () => void): (() => void) | undefined {
  if (!GAMES.has(namespace)) return;
  let roomId = '';
  let preparing = false; // A started snapshot was seen and the server barrier is still closed.
  let received = false;
  let active = false; // play_started_at is immutable, so the barrier stays open for this room.
  let disposed = false;
  let countdown: ReturnType<typeof setTimeout> | undefined;
  const send = socket.emit.bind(socket);
  const on = socket.on.bind(socket);
  const stopCountdown = () => { clearTimeout(countdown); countdown = undefined; };
  const open = () => { active = true; preparing = false; stopCountdown(); setPending(roomId, false); };
  const acknowledge = () => {
    if (!disposed && socket.connected && roomId && received && !active && !countdown) send('initial_state_ack', { roomId });
  };
  socket.emit = ((event: string, ...args: any[]) => {
    if (event === 'join') {
      const next = args[0]?.room_id;
      if (typeof next === 'string' && next !== roomId) {
        if (roomId) setPending(roomId, false);
        roomId = next; preparing = false; received = false; active = false; stopCountdown();
      }
    }
    if (ACTIONS.has(event) && preparing) return socket;
    return send(event, ...args);
  }) as Socket['emit'];
  socket.on = ((event: string, handler: (...args: any[]) => void) => {
    if (event !== namespace.slice(1)) return on(event, handler);
    return on(event, (...args: any[]) => {
      handler(...args); // A throwing/failed application must never acknowledge readiness.
      const envelope = args[0];
      const data = envelope?.data;
      const target = data?.roomId ?? data?.room_id;
      if (!roomId || envelope?.success === false || (target && target !== roomId)) return;
      if (data?.gameEnded) { open(); return; }
      if (active || data?.isSpectator || !data?.gameStarted) return;
      if (!preparing) { preparing = true; setPending(roomId, true); }
      if (hasInitialState(namespace, data)) { received = true; acknowledge(); }
      else resync();
    });
  }) as Socket['on'];
  on('match_start_state', (state: any) => {
    if (!roomId || state?.roomId !== roomId || active) return;
    if (state.phase === 'finished') { open(); resync(); return; }
    if (state.phase !== 'active' && state.phase !== 'legacy') return;
    if (!received) { resync(); return; }
    if (countdown) return;
    const wait = state.phase === 'legacy' ? 0 : Math.max(0, Date.parse(state.startsAt) - Date.parse(state.serverNow));
    if (!Number.isFinite(wait)) return;
    countdown = setTimeout(() => {
      if (disposed) return;
      open(); resync();
    }, wait);
  });
  // The server refused an action as not yet playable; restore its authoritative view.
  on('match_start_retry', () => { if (active) resync(); });
  // A reconnect must re-apply the snapshot before acknowledging again.
  on('disconnect', () => { received = false; stopCountdown(); });
  // Retry on the bounded interval; never create an error/ack feedback loop.
  const retry = setInterval(() => {
    if (preparing && !active && socket.connected) {
      if (received) acknowledge(); else resync();
    }
  }, RETRY_MS);
  return () => {
    disposed = true; clearInterval(retry); stopCountdown();
    if (roomId) setPending(roomId, false);
    socket.emit = send as Socket['emit']; socket.on = on as Socket['on'];
  };
}
