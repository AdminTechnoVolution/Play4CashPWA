import type { ConnectFourCell, ConnectFourDisc, ConnectFourMove } from '../../../data/models/connectFourModels';
import { SpectatorPayload } from '../../../util/SpectatorPayload';

export function deriveConnectFourOpponentName(
  p1: string,
  p2: string,
  myUserId: string,
  players: unknown,
  fallback: string,
): string {
  const id = myUserId.trim();
  if (Array.isArray(players) && id) {
    for (const p of players) {
      if (!p || typeof p !== 'object') continue;
      const entry = p as { userId?: string; username?: string };
      const uid = String(entry.userId ?? '').trim();
      const name = String(entry.username ?? '').trim();
      if (uid && name && uid !== id) return name;
    }
    const p1Id = String((players[0] as { userId?: string })?.userId ?? '').trim();
    const p2Id = String((players[1] as { userId?: string })?.userId ?? '').trim();
    if (p1Id === id && p2.trim()) return p2.trim();
    if (p2Id === id && p1.trim()) return p1.trim();
  }
  const fb = fallback.trim();
  if (fb && fb.toLowerCase() !== 'waiting') return fb;
  return p1.trim() && p2.trim() ? (p1.trim() !== fb ? p1.trim() : p2.trim()) : fb || p1.trim() || p2.trim();
}

export function resolveConnectFourYourTurn(
  data: Record<string, unknown>,
  prior: boolean,
): boolean {
  if (Object.prototype.hasOwnProperty.call(data, 'yourTurn')) return !!data.yourTurn;
  if (Object.prototype.hasOwnProperty.call(data, 'your_turn')) return !!data.your_turn;
  return prior;
}

export function resolveConnectFourBoard(
  data: Record<string, unknown>,
  prior: ConnectFourCell[][],
  parseBoard: (raw: unknown) => ConnectFourCell[][],
): ConnectFourCell[][] {
  if (Object.prototype.hasOwnProperty.call(data, 'board') && Array.isArray(data.board)) {
    return parseBoard(data.board);
  }
  return prior;
}

export function resolveConnectFourLastMove(
  data: Record<string, unknown>,
  prior: ConnectFourMove | null,
  parseLastMove: (raw: unknown) => ConnectFourMove | null,
): ConnectFourMove | null {
  if (
    Object.prototype.hasOwnProperty.call(data, 'lastMove') ||
    Object.prototype.hasOwnProperty.call(data, 'last_move')
  ) {
    return parseLastMove(data.lastMove ?? data.last_move);
  }
  return prior;
}

export function connectFourPlayStatusMessage(
  yourTurn: boolean,
  turnHolder: string,
  spectating: boolean,
  spectatorStatus: string,
): string {
  if (spectating) return spectatorStatus;
  if (yourTurn) return 'connect_four_status_your_turn';
  if (turnHolder.trim()) return `bs_named_opponent_turn|${turnHolder.trim()}`;
  return 'connect_four_status_opponent_turn';
}

export function connectFourTurnHolderUsername(data: Record<string, unknown>): string {
  const ext = SpectatorPayload.extractStandardTurnAndNames(data);
  if (ext.turnHolder) return ext.turnHolder;
  const cp = Number(data.currentPlayer ?? data.current_player);
  const p1 = String(data.player1 ?? '').trim();
  const p2 = String(data.player2 ?? '').trim();
  if (cp === 1 && p1) return p1;
  if (cp === 2 && p2) return p2;
  const turnId = String(data.currentTurnUserId ?? data.current_turn_user_id ?? '').trim();
  const players = data.players;
  if (Array.isArray(players)) {
    for (const p of players) {
      if (p && typeof p === 'object' && String((p as { userId?: string }).userId) === turnId) {
        return String((p as { username?: string }).username ?? '').trim();
      }
    }
  }
  return SpectatorPayload.spectatorTurnHolderUsername(data);
}

export function payloadIndicatesConnectFourPlay(
  data: Record<string, unknown>,
  phase: string,
  hadMoveInFlight: boolean,
): boolean {
  const gameStarted = !!data?.gameStarted || !!data?.game_started;
  const roomStarted = String(data?.status || '').toLowerCase() === 'started';
  const hasBoard = data?.board != null;
  const hasTurn = Object.prototype.hasOwnProperty.call(data, 'yourTurn') ||
    Object.prototype.hasOwnProperty.call(data, 'your_turn');
  const hasLastMove =
    Object.prototype.hasOwnProperty.call(data, 'lastMove') ||
    Object.prototype.hasOwnProperty.call(data, 'last_move');
  return (
    gameStarted ||
    roomStarted ||
    (phase === 'PLAY' && (hasBoard || hasTurn || hasLastMove || hadMoveInFlight))
  );
}

export function resolveConnectFourYourColor(
  data: Record<string, unknown>,
  prior: ConnectFourDisc | null,
): ConnectFourDisc | null {
  if (data.yourColor === 'R' || data.yourColor === 'Y') return data.yourColor;
  if (data.your_color === 'R' || data.your_color === 'Y') return data.your_color;
  if (data.isPlayerOne !== undefined) return data.isPlayerOne ? 'R' : 'Y';
  return prior;
}

export function isConnectFourResyncOnlyPayload(data: Record<string, unknown>): boolean {
  return !!data.resyncOnly || !!data.resync_only;
}

export function parseConnectFourMoveRevision(data: Record<string, unknown>): number | null {
  const raw = data.moveRevision ?? data.move_revision;
  if (raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function countConnectFourDiscs(board: ConnectFourCell[][]): number {
  let n = 0;
  for (const row of board) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell === 'R' || cell === 'Y') n++;
    }
  }
  return n;
}

function countDiscsInRawBoard(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  let n = 0;
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (cell === 'R' || cell === 'Y') n++;
    }
  }
  return n;
}

/** Reject stale join/move payloads that would regress board state during PLAY. */
export function shouldApplyConnectFourPlayPayload(
  data: Record<string, unknown>,
  currentRevision: number,
  currentBoard: ConnectFourCell[][],
  phase: string,
  parseBoardFn: (raw: unknown) => ConnectFourCell[][],
): boolean {
  if (isConnectFourResyncOnlyPayload(data)) return false;

  const incomingRev = parseConnectFourMoveRevision(data);
  if (incomingRev != null && currentRevision > 0 && incomingRev < currentRevision) {
    return false;
  }
  if (incomingRev != null && incomingRev >= currentRevision) {
    return true;
  }

  const hasLastMove =
    Object.prototype.hasOwnProperty.call(data, 'lastMove') ||
    Object.prototype.hasOwnProperty.call(data, 'last_move');
  if (phase === 'PLAY' && hasLastMove) {
    return true;
  }

  if (phase === 'PLAY' && Object.prototype.hasOwnProperty.call(data, 'board')) {
    const rawCount = countDiscsInRawBoard(data.board);
    if (rawCount != null) {
      const currentCount = countConnectFourDiscs(currentBoard);
      if (rawCount > currentCount) return true;
      if (rawCount < currentCount) return false;
    }
    if (Array.isArray(data.board)) {
      const parsed = parseBoardFn(data.board);
      if (countConnectFourDiscs(parsed) < countConnectFourDiscs(currentBoard)) {
        return false;
      }
    }
  }

  return true;
}

export function resolveAppliedConnectFourMoveRevision(
  data: Record<string, unknown>,
  priorRevision: number,
): number {
  const incoming = parseConnectFourMoveRevision(data);
  if (incoming != null) return Math.max(priorRevision, incoming);
  return priorRevision;
}
