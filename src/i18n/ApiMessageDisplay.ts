import { t, hasKey } from './translations';

/** Matches server English prose to the same entries as `ws.*` keys in our catalog. */
const normalizeEnglishApiLiteral = (s: string): string =>
  s.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\.\!\?]+$/, '');

/**
 * When REST/socket returns the English `en` string instead of the key, still show the user
 * the localized line for their app language.
 */
const englishApiLiteralToKey: Record<string, string> = {
  [normalizeEnglishApiLiteral("You are not a member of this room")]: "ws.games.notInRoom",
  [normalizeEnglishApiLiteral("Game not found")]: "ws.games.gameNotFound",
  [normalizeEnglishApiLiteral("Room is no longer active")]: "ws.games.roomInactive",
  [normalizeEnglishApiLiteral("Spectators cannot perform actions")]: "ws.games.spectatorActionDenied",
  [normalizeEnglishApiLiteral("Insufficient balance")]: "ws.games.insufficientBalance",
  [normalizeEnglishApiLiteral("Reconnected to room")]: "ws.games.roomReconnected",
  [normalizeEnglishApiLiteral("Waiting for opponent")]: "ws.games.waitingOpponent",
  [normalizeEnglishApiLiteral("Game started! Good luck")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Game started! Good luck.")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Game started!")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Opponent joined! Game starting")]: "halma_status_place_pieces",
  [normalizeEnglishApiLiteral("Opponent joined! Game starting…")]: "halma_status_place_pieces",
  [normalizeEnglishApiLiteral("It is not your turn")]: "ws.games.notYourTurn",
  [normalizeEnglishApiLiteral("Invalid move")]: "ws.games.invalidMove",
};

const resolveApiMessageLine = (trimmedLine: string): string => {
  if (hasKey(trimmedLine)) return t(trimmedLine);
  const key = englishApiLiteralToKey[normalizeEnglishApiLiteral(trimmedLine)];
  if (key && hasKey(key)) return t(key);
  return trimmedLine;
};

/**
 * Replaces `{{key}}` placeholders using string fields from [data] (WebSocket contract).
 * Unknown or empty values leave the placeholder as-is.
 */
export const applyWsMessagePlaceholders = (template: string, data: any): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    let value: string | undefined;
    if (key === 'username') {
      value = ['username', 'userName', 'displayName', 'playerName', 'player_name']
        .map(k => String(data[k] || '').trim())
        .find(v => v.length > 0);
    } else if (key === 'shipType') {
      value = ['shipType', 'ship_type', 'ship']
        .map(k => String(data[k] || '').trim())
        .find(v => v.length > 0);
    } else {
      value = String(data[key] || '').trim() || undefined;
    }
    return value ?? match;
  });
};

/**
 * Turns API error text into what we show in the UI.
 * - Empty → localized [emptyFallbackKey].
 * - If the API sent a catalog key → localized string.
 * - If the API sent the English prose that matches a known `ws.games.*` line → same localization as that key.
 * - Otherwise → the API text as-is.
 */
export function formatApiMessageForDisplay(raw: string | null | undefined, emptyFallbackKey: string = 'error_try_later_message'): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return t(emptyFallbackKey);
  return resolveApiMessageLine(trimmed);
}

/**
 * Like [formatApiMessageForDisplay] but supports several lines (e.g. joined `messages[]`).
 * Each non-empty line is either an [AppStrings] key or literal text.
 */
export function formatApiMessagesBlockForDisplay(raw: string | null | undefined, fallbackIfEmpty: string = ''): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return fallbackIfEmpty;
  const mapped = trimmed.split('\n')
    .map(line => {
      const tLine = line.trim();
      return tLine ? resolveApiMessageLine(tLine) : '';
    })
    .filter(Boolean)
    .join('\n');
  return mapped || fallbackIfEmpty;
}

// ── Game End Reasoning (Mirroring GameEndReason.kt logic) ───────────────────

const GAME_END_OPPONENT_TIMEOUT_REASONS = new Set(["timeout", "opponent_timeout", "opponent_timer", "timer", "turn_timeout", "timeout_loss"]);
const GAME_END_OWN_TIMEOUT_REASONS = new Set(["timeout", "player_timeout", "timer", "turn_timeout", "timeout_loss"]);
const GAME_END_OPPONENT_DISCONNECT_REASONS = new Set(["opponent_disconnect", "opponent_disconnected", "player_disconnected", "disconnect", "offline", "left", "abandoned", "forfeit"]);
const GAME_END_CHECKMATE_REASONS = new Set(["checkmate", "check_mate", "check-mate"]);

function normalizedGameEndReason(data: any): string {
  return (data.reason || data.endReason || data.end_reason || data.winnerReason || data.winner_reason || data.gameEndReason || data.game_end_reason || data.result || '')
    .trim()
    .toLowerCase();
}

export type PlayerGameEndReasonProfile = 'CHESS' | 'HALMA' | 'BATTLESHIP' | 'DOMINO';

export interface GameEndMessageKeys {
  victoryOpponentTimeout: string;
  defeatOwnTimeout: string;
  victoryOpponentDisconnected: string;
  victoryDefault: string;
  defeatDefault: string;
  victoryForfeit?: string;
  defeatForfeit?: string;
  victoryCheckmate?: string;
  defeatCheckmate?: string;
  draw?: string;
  stalemate?: string;
  insufficientMaterial?: string;
}

export function resolveGameEndFallbackMessage(
  data: any,
  outcome: string,
  youWon: boolean,
  isDraw: boolean,
  keys: GameEndMessageKeys,
  victoryOpponentDisconnectedOverride?: string
): string {
  const reason = normalizedGameEndReason(data);
  if (isDraw) {
    const k = (outcome === 'stalemate' ? keys.stalemate : outcome === 'insufficient_material' ? keys.insufficientMaterial : keys.draw) || keys.draw || keys.defeatDefault;
    return t(k);
  }
  if (!youWon && (outcome === 'timeout_loss' || GAME_END_OWN_TIMEOUT_REASONS.has(reason))) {
    return t(keys.defeatOwnTimeout);
  }
  if (youWon && GAME_END_OPPONENT_TIMEOUT_REASONS.has(reason)) {
    return t(keys.victoryOpponentTimeout);
  }
  if (youWon && (outcome === 'opponent_disconnected' || GAME_END_OPPONENT_DISCONNECT_REASONS.has(reason))) {
    return victoryOpponentDisconnectedOverride || t(keys.victoryOpponentDisconnected);
  }
  
  if (!isDraw && keys.victoryCheckmate && keys.defeatCheckmate) {
    const endedByCheckmate = outcome === 'checkmate' || GAME_END_CHECKMATE_REASONS.has(reason) || !!data.checkmate || !!data.isCheckmate || !!data.is_checkmate;
    if (endedByCheckmate) {
      return t(youWon ? keys.victoryCheckmate : keys.defeatCheckmate);
    }
  }

  switch (outcome) {
    case 'forfeit':
      return t((youWon ? keys.victoryForfeit : keys.defeatForfeit) || (youWon ? keys.victoryDefault : keys.defeatDefault));
    case 'timeout_loss':
      return t(keys.defeatOwnTimeout);
    case 'opponent_disconnected':
      return youWon ? (victoryOpponentDisconnectedOverride || t(keys.victoryOpponentDisconnected)) : t(keys.defeatDefault);
    case 'checkmate':
      return t((youWon ? keys.victoryCheckmate : keys.defeatCheckmate) || (youWon ? keys.victoryDefault : keys.defeatDefault));
    case 'win':
      return t(keys.victoryDefault);
    case 'lose':
      return t(keys.defeatDefault);
    case 'draw':
      return t(keys.draw || keys.defeatDefault);
    case 'stalemate':
      return t(keys.stalemate || keys.draw || keys.defeatDefault);
    case 'insufficient_material':
      return t(keys.insufficientMaterial || keys.draw || keys.defeatDefault);
  }
  return t(youWon ? keys.victoryDefault : keys.defeatDefault);
}

/**
 * Localized **reason-only** line for the game-over dialog body (after “You won” / “You lost”).
 * Avoids repeating the victory/defeat headline already shown in the title.
 */
export function playerGameEndReasonFallback(
  data: any,
  outcome: string,
  youWon: boolean,
  isDraw: boolean,
  profile: PlayerGameEndReasonProfile
): string {
  const reason = normalizedGameEndReason(data);
  const o = outcome.trim().toLowerCase();
  
  if (isDraw || o === 'draw' || reason === 'draw') {
    if (o === 'stalemate' || reason === 'stalemate') {
      return profile === 'CHESS' ? t('chess_stalemate') : t('spectator_match_draw_result');
    }
    if (o === 'insufficient_material' || reason === 'insufficient_material') {
      return profile === 'CHESS' ? t('chess_insufficient_material') : t('spectator_end_insufficient_material');
    }
    return t('spectator_match_draw_result');
  }

  if (!youWon && (o === 'timeout_loss' || GAME_END_OWN_TIMEOUT_REASONS.has(reason))) {
    return t('room_winner_reason_timeout_lost');
  }
  if (youWon && GAME_END_OPPONENT_TIMEOUT_REASONS.has(reason)) {
    return t('room_winner_reason_timeout_won');
  }
  if (youWon && (o === 'opponent_disconnected' || GAME_END_OPPONENT_DISCONNECT_REASONS.has(reason))) {
    return t('room_winner_reason_forfeit_won');
  }
  if (!youWon && (o === 'opponent_disconnected' || GAME_END_OPPONENT_DISCONNECT_REASONS.has(reason))) {
    return t('spectator_end_disconnected');
  }
  
  if (o === 'forfeit') {
    return t(youWon ? 'room_winner_reason_forfeit_won' : 'room_winner_reason_forfeit_lost');
  }

  if (profile === 'CHESS') {
    const endedByCheckmate = o === 'checkmate' || GAME_END_CHECKMATE_REASONS.has(reason) || !!data.checkmate || !!data.isCheckmate || !!data.is_checkmate;
    if (endedByCheckmate) {
      return t('spectator_end_checkmate');
    }
  }

  switch (profile) {
    case 'CHESS':
      return t('spectator_end_decisive');
    case 'HALMA':
      return t(youWon ? 'game_over_reason_halma_won' : 'game_over_reason_halma_lost');
    case 'BATTLESHIP':
      return t(youWon ? 'game_over_reason_bs_won' : 'game_over_reason_bs_lost');
    case 'DOMINO':
      return t(youWon ? 'game_over_reason_domino_won' : 'game_over_reason_domino_lost'); // Added Domino profile support
    default:
      return '';
  }
}

/** Normalized lobby lifecycle for a room, derived from the API `status` string. */
export type RoomLobbyKind = 'WAITING' | 'STARTED' | 'OTHER';

const waitingKeys = new Set([
  "waiting", "wait", "pending", "esperando", "en espera", "pendiente",
  "en attente", "attente", "wartend", "warten", "in attesa",
  "aguardando", "pendente", "room_status_waiting"
]);

export function classifyRoomLobbyStatus(raw: string): RoomLobbyKind {
  const cleaned = (raw || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  if (!cleaned) return 'OTHER';
  if (waitingKeys.has(cleaned)) return 'WAITING';
  if (cleaned === 'started' || cleaned.replace(/[\s\-_]+/g, '') === 'started') return 'STARTED';
  return 'OTHER';
}
