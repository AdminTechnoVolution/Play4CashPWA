import type { DominoTile } from '../../../data/models/ApiModels';
import {
  GAME_END_OPPONENT_TIMEOUT_REASONS,
  GAME_END_OWN_TIMEOUT_REASONS,
  normalizedGameEndReason,
} from '../../../i18n/ApiMessageDisplay';

export type DominoBoardEnd = { tiles: DominoTile[]; leftEnd: number; rightEnd: number };

export function parseHandArray(data: any): DominoTile[] {
  const arr = data?.hand;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item: any) => {
      const t = Array.isArray(item) ? item : item?.tile;
      if (!Array.isArray(t) || t.length < 2) return null;
      return { a: Number(t[0]), b: Number(t[1]) };
    })
    .filter((x): x is DominoTile => x != null);
}

/** Server board: [[a,b], …] chain left→right */
export function parseBoardArray(data: any): DominoBoardEnd {
  const arr = data?.board;
  if (!Array.isArray(arr) || arr.length === 0) return { tiles: [], leftEnd: -1, rightEnd: -1 };
  const tiles: DominoTile[] = [];
  for (let i = 0; i < arr.length; i++) {
    const t = arr[i];
    const pair = Array.isArray(t) ? t : null;
    if (!pair || pair.length < 2) continue;
    tiles.push({ a: Number(pair[0]), b: Number(pair[1]) });
  }
  if (tiles.length === 0) return { tiles: [], leftEnd: -1, rightEnd: -1 };
  return { tiles, leftEnd: tiles[0].a, rightEnd: tiles[tiles.length - 1].b };
}

export function dominoLastTileFromHistory(history: any): DominoTile | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const o = history[i];
    if (!o || typeof o !== 'object') continue;
    const type = String(o.type || 'move')
      .trim()
      .toLowerCase();
    if (type === 'pass') continue;
    const tile = o.tile || o.Tile;
    const arr = Array.isArray(tile) ? tile : null;
    if (arr && arr.length >= 2) return { a: Number(arr[0]), b: Number(arr[1]) };
  }
  return null;
}

export function computeValidMovesClient(
  hand: DominoTile[],
  leftEnd: number,
  rightEnd: number,
): { tile: DominoTile; sides: ('left' | 'right')[] }[] {
  if (leftEnd === -1 && rightEnd === -1) {
    return hand.map((tile) => ({ tile, sides: ['left' as const] }));
  }
  return hand
    .map((tile) => {
      const sides: ('left' | 'right')[] = [];
      if (tile.a === leftEnd || tile.b === leftEnd) sides.push('left');
      if (tile.a === rightEnd || tile.b === rightEnd) sides.push('right');
      return { tile, sides };
    })
    .filter((m) => m.sides.length > 0);
}

export function computeBoneyardInvariant(
  boardLen: number,
  handLen: number,
  opponentTileSum: number,
): number {
  return Math.max(0, 28 - boardLen - handLen - opponentTileSum);
}

export function sumOpponentHandCounts(handCount: Record<string, number> | null | undefined, myUserId: string): number {
  if (!handCount || typeof handCount !== 'object') return 0;
  let sum = 0;
  for (const [k, v] of Object.entries(handCount)) {
    if (k === myUserId) continue;
    sum += Number(v) || 0;
  }
  return sum;
}

export function parseLobbyJoinedCount(data: any): number | null {
  const pl = data?.players;
  if (Array.isArray(pl)) return pl.length;
  const keys = [
    'playersJoined',
    'players_joined',
    'currentPlayers',
    'current_players',
    'playersInRoom',
    'players_in_room',
    'playerCount',
    'player_count',
  ];
  for (const k of keys) {
    if (data?.[k] !== undefined) {
      const v = parseInt(String(data[k]), 10);
      if (!Number.isNaN(v) && v >= 0) return v;
    }
  }
  return null;
}

export function parseLobbyRequiredCount(data: any): number | null {
  const keys = [
    'playersRequired',
    'players_required',
    'playerLimit',
    'player_limit',
    'maxPlayers',
    'max_players',
    'requiredPlayers',
    'required_players',
  ];
  for (const k of keys) {
    if (data?.[k] !== undefined) {
      const v = parseInt(String(data[k]), 10);
      if (!Number.isNaN(v) && v > 1) return v;
    }
  }
  return null;
}

/** Map handCount ids → display labels (Android parseHandCount). */
export function opponentsFromHandCount(
  data: any,
  handCount: Record<string, number> | null | undefined,
  myUserId: string,
  initialOpponentName: string,
): { username: string; tileCount: number }[] {
  if (!handCount || typeof handCount !== 'object') return [];
  const idToName = new Map<string, string>();
  const players = data?.players;
  if (Array.isArray(players)) {
    players.forEach((p: any) => {
      const id = (p?.playerId?._id || p?.playerId?.id || p?.user?._id || p?.user?.id || p?.id || '').toString().trim();
      const un =
        (p?.playerId?.username || p?.user?.username || p?.username || '').toString().trim();
      if (id && un) idToName.set(id, un);
    });
  }
  const result: { username: string; tileCount: number }[] = [];
  let idx = 1;
  for (const key of Object.keys(handCount)) {
    if (key === myUserId) continue;
    const count = Number(handCount[key]) || 0;
    const named = idToName.get(key);
    let label = named;
    if (!label) {
      label = result.length === 0 && initialOpponentName.trim().length > 0 ? initialOpponentName : `Opp ${idx}`;
    }
    result.push({ username: label, tileCount: count });
    idx++;
  }
  return result;
}

/**
 * Translation keys for game-over body (GameOverModal applies t()).
 * Mirrors DominoViewModel.dominoPlayerReasonOnly (keys, not resolved strings).
 */
export function dominoPlayerReasonKey(
  resolvedOutcome: string,
  youWon: boolean,
  isDraw: boolean,
  reasonNorm: string,
  isForfeitEnd: boolean,
  isLastStandingWin: boolean,
  isLastStandingLoss: boolean,
  opponentForfeit: boolean,
): string {
  const o = resolvedOutcome.trim().toLowerCase();
  if (reasonNorm === 'blocked_game') return 'domino_game_blocked';
  if (isDraw) return 'spectator_match_draw_result';
  if (youWon && opponentForfeit) return 'room_winner_reason_forfeit_won';
  if (youWon && isForfeitEnd && !opponentForfeit) return 'domino_go_reason_forfeit_win';
  if (!youWon && !isDraw && isForfeitEnd && !opponentForfeit) return 'domino_go_reason_forfeit_loss';
  if (youWon && reasonNorm === 'empty_hand') return 'domino_go_reason_empty_hand_win';
  if (!youWon && reasonNorm === 'empty_hand') return 'domino_go_reason_empty_hand_loss';
  // Timeout / elimination: server sends outcome timeout_loss (or reason in OWN_TIMEOUT set).
  if (!youWon && (o === 'timeout_loss' || GAME_END_OWN_TIMEOUT_REASONS.has(reasonNorm))) {
    return 'ws.domino.timeout';
  }
  if (
    youWon &&
    (o === 'timeout_win' ||
      o === 'win_by_timeout' ||
      GAME_END_OPPONENT_TIMEOUT_REASONS.has(reasonNorm))
  ) {
    return 'room_winner_reason_timeout_won';
  }
  if (isLastStandingWin) return 'domino_go_reason_last_standing_win';
  if (isLastStandingLoss) return 'domino_go_reason_last_standing_loss';
  return 'spectator_end_decisive';
}

export function buildDominoGameOverPayload(
  data: any,
  _json: any,
  myUserId: string,
): import('../../../data/models/ApiModels').GameOverPayload {
  const winnerId = String(data?.winner || '').trim();
  const reasonNorm = normalizedGameEndReason(data);
  const outcome = String(data?.outcome || '').trim();
  const outcomeNorm = outcome.toLowerCase();
  const isForfeitEnd = reasonNorm === 'forfeit' || outcomeNorm === 'forfeit';
  const opponentForfeit =
    outcome === 'opponent_disconnected' ||
    reasonNorm === 'opponent_disconnect' ||
    reasonNorm === 'opponent_disconnected';

  let youWon = false;
  if (opponentForfeit) youWon = true;
  else if (winnerId && myUserId) youWon = winnerId === myUserId;
  else youWon = !!data?.youWon || !!data?.you_won;

  const isDraw =
    outcomeNorm === 'draw' ||
    reasonNorm === 'draw' ||
    !!data?.isDraw ||
    !!data?.draw ||
    (!winnerId && reasonNorm !== 'timeout' && !opponentForfeit);

  const resolvedOutcome = opponentForfeit
    ? 'opponent_disconnected'
    : outcome || (isForfeitEnd ? 'forfeit' : youWon ? 'win' : 'lose');

  const isLastStandingWin = youWon && (reasonNorm === 'last_standing' || reasonNorm === 'laststanding');
  const isLastStandingLoss = !youWon && !isDraw && (reasonNorm === 'last_standing' || reasonNorm === 'laststanding');

  const reasonKey = dominoPlayerReasonKey(
    resolvedOutcome,
    youWon,
    isDraw,
    reasonNorm,
    isForfeitEnd,
    isLastStandingWin,
    isLastStandingLoss,
    opponentForfeit,
  );

  const prize = typeof data?.prize === 'number' && data.prize > 0 ? data.prize : undefined;

  return {
    outcome: isDraw ? 'draw' : youWon ? 'win' : 'lose',
    youWon: !isDraw && youWon,
    isDraw,
    winner: isDraw ? undefined : youWon ? 'You' : 'Opponent',
    reason: reasonKey,
    prize: youWon && !isDraw ? prize : undefined,
  };
}
