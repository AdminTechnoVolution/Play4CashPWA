import { t, hasKey } from './translations';

/** Matches server English prose to the same entries as `ws.*` keys in our catalog. */
const normalizeEnglishApiLiteral = (s: string): string => {
  let x = s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  // Strip trailing ellipsis (ASCII …, U+2026, or ...) then standard sentence punctuation
  x = x.replace(/(\u2026|…)+$/g, '').replace(/\.{3,}$/g, '');
  x = x.replace(/[\.\!\?]+$/, '');
  return x;
};

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
  [normalizeEnglishApiLiteral("Waiting for an opponent")]: "domino_status_waiting_opponent",
  [normalizeEnglishApiLiteral("Waiting for more players")]: "domino_status_waiting_table",
  [normalizeEnglishApiLiteral("Game started! Good luck")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Game started! Good luck.")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Game started!")]: "ws.games.startedRoom",
  [normalizeEnglishApiLiteral("Opponent joined! Game starting")]: "halma_status_place_pieces",
  [normalizeEnglishApiLiteral("Opponent joined! Game starting…")]: "halma_status_place_pieces",
  [normalizeEnglishApiLiteral("It is not your turn")]: "ws.games.notYourTurn",
  [normalizeEnglishApiLiteral("Invalid move")]: "ws.games.invalidMove",
  [normalizeEnglishApiLiteral("Illegal move")]: "ws.chess.illegalMove",
  [normalizeEnglishApiLiteral("Illegal move. You are in check!")]: "ws.chess.illegalMoveInCheck",
  [normalizeEnglishApiLiteral("Room is full")]: "room_full",
  [normalizeEnglishApiLiteral("The room is full")]: "room_full",
  [normalizeEnglishApiLiteral("This room is full")]: "room_full",
  [normalizeEnglishApiLiteral("Amount is too low")]: "ERROR_WITHDRAWAL_INSUFFICIENT_BALANCE",
  [normalizeEnglishApiLiteral("Room already finished")]: "room_finished",
  [normalizeEnglishApiLiteral("Match finished")]: "room_finished",
  [normalizeEnglishApiLiteral("bet_amount must not be less than 1")]: "room_bet_min_error",
  // UNO — API may still send English prose from older builds
  [normalizeEnglishApiLiteral("This room is not an UNO game. Connect using the correct game namespace.")]: "ws.uno.wrongGame",
  [normalizeEnglishApiLiteral("That card cannot be played on the current discard.")]: "ws.uno.noMatch",
  [normalizeEnglishApiLiteral("You must play a +2 or Wild +4, or take the accumulated draw.")]: "ws.uno.mustRespondDrawStack",
  [normalizeEnglishApiLiteral("You cannot play +2 after a Wild +4 — play Wild +4 or take the draw.")]: "ws.uno.stackDraw2NotAllowed",
  [normalizeEnglishApiLiteral("You cannot play Wild +4 while you hold a card of the current color.")]: "ws.uno.wild4Illegal",
  [normalizeEnglishApiLiteral("Choose a color (R, G, B, or Y) when playing a wild card.")]: "ws.uno.chosenColorRequired",
  [normalizeEnglishApiLiteral("Invalid card index.")]: "ws.uno.invalidCard",
  [normalizeEnglishApiLiteral("You are eliminated from this hand.")]: "ws.uno.eliminated",
  [normalizeEnglishApiLiteral("There is no draw stack to take.")]: "ws.uno.noDrawStack",
  [normalizeEnglishApiLiteral("You must play a +2 or Wild +4 from your hand — you cannot take the stack while you can respond.")]: "ws.uno.mustPlayStackCard",
  [normalizeEnglishApiLiteral("You cannot draw from the deck while a +2/+4 stack is pending.")]: "ws.uno.cannotDrawStack",
  [normalizeEnglishApiLiteral("No cards left to draw.")]: "ws.uno.deckEmpty",
  [normalizeEnglishApiLiteral("Resolve the draw stack before passing.")]: "ws.uno.mustResolveStack",
  [normalizeEnglishApiLiteral("You have a legal card to play; you cannot pass.")]: "ws.uno.hasLegalPlay",
  [normalizeEnglishApiLiteral("Game state updated.")]: "ws.uno.stateUpdated",
  [normalizeEnglishApiLiteral("You must take the pending +2/+4 (stacking is disabled).")]: "ws.uno.mustTakeStack",
  [normalizeEnglishApiLiteral("You cannot say UNO right now.")]: "ws.uno.callNotAllowed",
  [normalizeEnglishApiLiteral("You can't challenge: you are not part of this room.")]: "ws.uno.invalidAccuser",
  [normalizeEnglishApiLiteral("UNO!")]: "ws.uno.youCalledUno",
  [normalizeEnglishApiLiteral("There is no one to challenge.")]: "ws.uno.challengeFail",
  // UNO — legacy API responses already translated to Spanish
  [normalizeEnglishApiLiteral("Esta sala no es de UNO. Conéctate con el namespace del juego correcto.")]: "ws.uno.wrongGame",
  [normalizeEnglishApiLiteral("Esa carta no se puede jugar sobre el descarte actual.")]: "ws.uno.noMatch",
  [normalizeEnglishApiLiteral("Debes jugar un +2 o comodín +4, o robar el acumulado.")]: "ws.uno.mustRespondDrawStack",
  [normalizeEnglishApiLiteral("No puedes jugar +2 después de un +4 — juega un +4 o toma el acumulado.")]: "ws.uno.stackDraw2NotAllowed",
  [normalizeEnglishApiLiteral("No puedes jugar comodín +4 si tienes una carta del color actual.")]: "ws.uno.wild4Illegal",
  [normalizeEnglishApiLiteral("Elige un color (R, G, B o Y) al jugar un comodín.")]: "ws.uno.chosenColorRequired",
  [normalizeEnglishApiLiteral("Índice de carta no válido.")]: "ws.uno.invalidCard",
  [normalizeEnglishApiLiteral("Has sido eliminado de esta mano.")]: "ws.uno.eliminated",
  [normalizeEnglishApiLiteral("No hay acumulado para robar.")]: "ws.uno.noDrawStack",
  [normalizeEnglishApiLiteral("Debes jugar un +2 o comodín +4 de tu mano; no puedes tomar el mazo si puedes responder.")]: "ws.uno.mustPlayStackCard",
  [normalizeEnglishApiLiteral("No puedes robar del mazo mientras hay acumulado de +2/+4.")]: "ws.uno.cannotDrawStack",
  [normalizeEnglishApiLiteral("No quedan cartas para robar.")]: "ws.uno.deckEmpty",
  [normalizeEnglishApiLiteral("Resuelve el acumulado antes de pasar.")]: "ws.uno.mustResolveStack",
  [normalizeEnglishApiLiteral("Tienes una jugada legal; no puedes pasar.")]: "ws.uno.hasLegalPlay",
  [normalizeEnglishApiLiteral("Estado del juego actualizado.")]: "ws.uno.stateUpdated",
  [normalizeEnglishApiLiteral("Debes tomar el acumulado de +2/+4 (no se permite encadenar).")]: "ws.uno.mustTakeStack",
  [normalizeEnglishApiLiteral("No puedes decir UNO en este momento.")]: "ws.uno.callNotAllowed",
  [normalizeEnglishApiLiteral("No puedes acusar: no eres parte de la sala.")]: "ws.uno.invalidAccuser",
  [normalizeEnglishApiLiteral("¡Dijiste UNO!")]: "ws.uno.youCalledUno",
  [normalizeEnglishApiLiteral("No hay nadie a quien acusar.")]: "ws.uno.challengeFail",
};

/** Parses minimum bet from API English e.g. `bet_amount must not be less than 5`. */
function parseMinBetFromBetAmountLiteral(raw: string): number | null {
  const m = raw.match(/less than (\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isRoomBetMinMessageKey(trimmedLine: string): boolean {
  if (trimmedLine === 'room_bet_min_error') return true;
  if (englishApiLiteralToKey[normalizeEnglishApiLiteral(trimmedLine)] === 'room_bet_min_error') return true;
  const low = trimmedLine.trim().toLowerCase();
  return /^bet_amount must not be less than \d+$/.test(low);
}

/** Android `String.format(getString("room_bet_min_error"), minBet)` — all locales use `%s` for the amount. */
export function formatRoomBetMinMessage(minBet: number): string {
  return t('room_bet_min_error').replace(/%s/g, String(minBet));
}

/** Server English: `{name} has joined the room!` (lobby / 4-player) → `ws.games.opponentJoined`. */
function tryResolveOpponentJoinedEnglishProse(trimmedLine: string): string | null {
  const m = trimmedLine.match(/^(.+?)\s+has joined the room!?$/i);
  if (!m) return null;
  const username = m[1].trim();
  if (!username || username.length > 80) return null;
  return applyWsMessagePlaceholders(t('ws.games.opponentJoined'), { username });
}

function resolveApiMessageLine(trimmedLine: string, opts?: { minBet?: number }): string {
  if (isRoomBetMinMessageKey(trimmedLine)) {
    const min = opts?.minBet ?? parseMinBetFromBetAmountLiteral(trimmedLine) ?? 1;
    return formatRoomBetMinMessage(min);
  }
  const joined = tryResolveOpponentJoinedEnglishProse(trimmedLine);
  if (joined != null) return joined;
  if (hasKey(trimmedLine)) return t(trimmedLine);
  const key = englishApiLiteralToKey[normalizeEnglishApiLiteral(trimmedLine)];
  if (key && hasKey(key)) return t(key);
  return trimmedLine;
}

/** Resolves a single API line to a catalog key when possible (mirrors Android `rawLineToMessageKey`). */
function rawLineToMessageKey(trimmedLine: string): string | null {
  if (!trimmedLine) return null;
  if (hasKey(trimmedLine)) return trimmedLine;
  const fromMap = englishApiLiteralToKey[normalizeEnglishApiLiteral(trimmedLine)];
  if (fromMap) return fromMap;
  const low = trimmedLine.trim().toLowerCase();
  if (/^bet_amount must not be less than \d+$/.test(low)) return 'room_bet_min_error';
  if (/^.+\s+has joined the room!?$/i.test(trimmedLine.trim())) return 'ws.games.opponentJoined';
  return null;
}

/** Android: `NON_BLOCKING_SOCKET_MESSAGE_KEYS` in ApiMessageDisplay.kt */
const NON_BLOCKING_SOCKET_MESSAGE_KEYS = new Set([
  'ws.games.opponentJoined',
  'ws.games.matchFound',
  'ws.games.startedRoom',
  'ws.games.waitingOpponent',
  'ws.games.roomReconnected',
]);

/**
 * When the server sends `success: false` with no `data`, some envelopes only carry informational keys.
 * Those must not open a blocking error modal during live play (Android parity).
 */
export function isInformationalNonBlockingSocketRaw(raw: string | null | undefined): boolean {
  if (raw == null || !String(raw).trim()) return true;
  const lines = String(raw)
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  for (const line of lines) {
    const key = rawLineToMessageKey(line);
    if (key == null) return false;
    if (!NON_BLOCKING_SOCKET_MESSAGE_KEYS.has(key)) return false;
  }
  return true;
}

/**
 * Android `String.format(getString(key), n)` for catalog lines that only use `%d`
 * (e.g. `domino_boneyard_count`). Does not use username fields.
 */
export function formatCatalogInteger(template: string, value: unknown): string {
  if (!template) return '';
  const raw = Number(value);
  const n = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
  return template.replace(/%d/g, String(n));
}

/**
 * Replaces `{{key}}` placeholders using string fields from [data] (WebSocket contract).
 * Unknown or empty values leave the placeholder as-is.
 */
export const applyWsMessagePlaceholders = (template: string, data: any): string => {
  if (!template) return '';
  let res = template;

  // 1. Handle {{key}} placeholders
  res = res.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    let value: string | undefined;
    if (key === 'username') {
      value = ['username', 'userName', 'displayName', 'playerName', 'player_name', 'winner', 'winnerName']
        .map(k => String(data[k] ?? '').trim())
        .find(v => v.length > 0);
    } else if (key === 'shipType') {
      value = ['shipType', 'ship_type', 'ship']
        .map(k => String(data[k] ?? '').trim())
        .find(v => v.length > 0);
    } else if (key === 'count' || key === 'amount') {
      value = String(data[key] ?? data.betAmount ?? data.count ?? '').trim() || undefined;
    } else {
      value = String(data[key] ?? '').trim() || undefined;
    }
    return value ?? match;
  });

  // 2. %d — must use numeric count/amount first (Android String.format); never substitute a name for %d
  if (res.includes('%d')) {
    let dv: string | null = null;
    if (data != null && data.count !== undefined && data.count !== null && data.count !== '') {
      const num = Number(data.count);
      if (Number.isFinite(num)) dv = String(Math.trunc(num));
    }
    if (dv == null && data != null && data.amount !== undefined && data.amount !== null && data.amount !== '') {
      const num = Number(data.amount);
      if (Number.isFinite(num)) dv = String(Math.trunc(num));
    }
    if (dv != null) {
      res = res.replace(/%d/g, dv);
    } else {
      const fallback =
        ['count', 'amount', 'username', 'userName', 'displayName', 'playerName', 'player_name', 'winner', 'winnerName']
          .map((k) => String(data[k] ?? '').trim())
          .find((v) => v.length > 0) || '';
      res = res.replace(/%d/g, fallback);
    }
  }

  // 3. %s — names / text (not used for integer-only domino stock labels)
  if (res.includes('%s')) {
    const val =
      ['username', 'userName', 'displayName', 'playerName', 'player_name', 'winner', 'winnerName', 'count', 'amount']
        .map((k) => String(data[k] ?? '').trim())
        .find((v) => v.length > 0) || '';
    res = res.replace(/%s/g, val);
  }

  return res;
};

/**
 * Turns API error text into what we show in the UI.
 * - Empty → localized [emptyFallbackKey].
 * - If the API sent a catalog key → localized string.
 * - If the API sent the English prose that matches a known `ws.games.*` line → same localization as that key.
 * - Otherwise → the API text as-is.
 * @param opts.minBet Optional game minimum when the API sends only `room_bet_min_error` or an unparseable line.
 */
/** Pull WS payload fields into {{username}}, {{score}}, {{round}}, etc. */
export function socketPlaceholdersFromData(data?: Record<string, unknown> | null): Record<string, string> {
  if (!data) return {};
  const uc = data.unoChallenge as Record<string, string> | undefined;
  return {
    username: String(
      data.roundWinnerUsername ??
        data.unoCallerName ??
        data.opponentName ??
        data.lastActionUsername ??
        data.username ??
        '',
    ).trim(),
    score: String(data.roundScoreDealt ?? data.lastRoundScoreDealt ?? data.score ?? '').trim(),
    round: String(data.roundNumber ?? data.round ?? '').trim(),
    accuser: String(uc?.accuserName ?? data.accuser ?? '').trim(),
    offender: String(uc?.offenderName ?? data.offender ?? '').trim(),
  };
}

/**
 * Resolves a socket message line (catalog key or legacy English) and applies payload placeholders.
 */
export function formatSocketMessageForDisplay(
  raw: string | null | undefined,
  data?: Record<string, unknown> | null,
  emptyFallbackKey: string = 'error_try_later_message',
  opts?: { minBet?: number },
): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return emptyFallbackKey ? t(emptyFallbackKey) : '';
  const key = rawLineToMessageKey(trimmed);
  if (key && hasKey(key)) {
    return applyWsMessagePlaceholders(t(key), socketPlaceholdersFromData(data));
  }
  const resolved = resolveApiMessageLine(trimmed, opts);
  return applyWsMessagePlaceholders(resolved, socketPlaceholdersFromData(data));
}

export function formatApiMessageForDisplay(
  raw: string | null | undefined,
  emptyFallbackKey: string = 'error_try_later_message',
  opts?: { minBet?: number },
): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return t(emptyFallbackKey);
  return resolveApiMessageLine(trimmed, opts);
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

/**
 * Standard status message resolver for game stores/pages.
 * Handles the "key|variable" pattern and resolves placeholders.
 */
export function tStatus(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const [key, val] = trimmed.split('|');
  const translated = t(key);
  
  // If translated text is just the key, it means translation was missing or it's a literal.
  // We apply placeholders regardless.
  return applyWsMessagePlaceholders(translated, { username: val, count: val, amount: val });
}

// ── Game End Reasoning (Mirroring GameEndReason.kt logic) ───────────────────

export const GAME_END_OPPONENT_TIMEOUT_REASONS = new Set([
  'timeout',
  'opponent_timeout',
  'opponent_timer',
  'timer',
  'turn_timeout',
  'timeout_loss',
  'timeout_win',
  'win_by_timeout',
]);
export const GAME_END_OWN_TIMEOUT_REASONS = new Set(["timeout", "player_timeout", "timer", "turn_timeout", "timeout_loss"]);
export const GAME_END_OPPONENT_DISCONNECT_REASONS = new Set(["opponent_disconnect", "opponent_disconnected", "player_disconnected", "disconnect", "offline", "left", "abandoned", "forfeit"]);
export const GAME_END_CHECKMATE_REASONS = new Set(["checkmate", "check_mate", "check-mate"]);

export function normalizedGameEndReason(data: any): string {
  return (data.reason || data.endReason || data.end_reason || data.winnerReason || data.winner_reason || data.gameEndReason || data.game_end_reason || data.result || '')
    .trim()
    .toLowerCase();
}

export type PlayerGameEndReasonProfile = 'CHESS' | 'HALMA' | 'BATTLESHIP' | 'DOMINO' | 'CONNECT_FOUR';

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
  profile: PlayerGameEndReasonProfile,
  isSpectator: boolean = false
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

  // Spectator third-person reasons (Mirroring Android SpectatorPayload logic)
  if (isSpectator) {
    if (isDraw || o === 'draw' || o === 'stalemate' || reason === 'stalemate' || reason === 'draw') {
      return t('spectator_match_draw_result');
    }
    if (o === 'insufficient_material' || reason === 'insufficient_material') {
      return t('spectator_end_insufficient_material');
    }
    if (o === 'opponent_disconnected' || GAME_END_OPPONENT_DISCONNECT_REASONS.has(reason)) {
      return t('spectator_end_disconnected');
    }
    if (o === 'forfeit' || reason === 'forfeit') {
      return t('spectator_end_forfeit');
    }
    if (o === 'timeout_loss' || GAME_END_OWN_TIMEOUT_REASONS.has(reason) || GAME_END_OPPONENT_TIMEOUT_REASONS.has(reason)) {
      return t('spectator_end_timeout');
    }
    if (o === 'checkmate' || reason === 'checkmate' || (profile === 'CHESS' && (!!data.checkmate || !!data.isCheckmate))) {
      return t('spectator_end_checkmate');
    }
    if (o === 'win' || o === 'lose') {
      return t('spectator_end_decisive');
    }
    return t('spectator_match_finished');
  }

  // Player first-person reasons
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
    return t('room_winner_reason_forfeit_won');
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
      return t(youWon ? 'game_over_reason_domino_won' : 'game_over_reason_domino_lost');
    case 'CONNECT_FOUR':
      return t(youWon ? 'connect_four_win' : 'connect_four_lose');
    default:
      return '';
  }
}

/** Normalized lobby lifecycle for a room, derived from the API `status` string. */
export type RoomLobbyKind = 'WAITING' | 'STARTED' | 'FINISHED' | 'OTHER';

const waitingKeys = new Set([
  "waiting", "wait", "pending", "esperando", "en espera", "pendiente",
  "en attente", "attente", "wartend", "warten", "in attesa",
  "aguardando", "pendente", "room_status_waiting", "room_waiting"
]);

const startedKeys = new Set([
  "started", "running", "playing", "jugando", "iniciado", "em andamento",
  "en cours", "gestartet", "läuft", "in corso", "room_status_started", "room_started"
]);

const finishedKeys = new Set([
  "finished", "completed", "finalizada", "terminada", "terminada", "encerrada",
  "complete", "termine", "geendet", "beendet", "completato", "terminato",
  "room_status_finished", "room_finished"
]);

export function classifyRoomLobbyStatus(raw: string): RoomLobbyKind {
  const cleaned = (raw || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  if (!cleaned) return 'OTHER';
  if (waitingKeys.has(cleaned)) return 'WAITING';
  if (startedKeys.has(cleaned)) return 'STARTED';
  if (finishedKeys.has(cleaned)) return 'FINISHED';
  return 'OTHER';
}

// ── Spectator Message Resolution (from legacy util) ─────────────────────────

const WS_GAME_END_OUTCOME_ONLY_KEYS = new Set([
  "ws.games.win", "ws.games.lose", "ws.games.draw", "ws.games.drawGeneric",
  "ws.games.gameOver", "ws.games.wins", "ws.games.winsForfeit",
  "ws.games.winsTimeout", "ws.games.winSunk", "ws.games.loseSunk",
]);

const gameEndSingleLine = (text: string): string =>
  text.split('\n').map(t => t.trim()).filter(t => t.length > 0).join(' — ');

export const apiMessagesJoinedOrNull = (obj: any): string | null => {
  const arr = obj?.messages || obj?.apiMessages;
  if (Array.isArray(arr) && arr.length > 0) {
    const parts = arr.map((m: any) => m?.toString().trim()).filter((m: any) => m && m.length > 0);
    if (parts.length > 0) return parts.join('\n');
  }
  const msg = obj?.message || obj?.msg;
  if (typeof msg === 'string' && msg.trim().length > 0) return msg.trim();
  return null;
};

const gameEndSingleStringOrNull = (obj: any): string | null => {
  const keys = [
    "statusMessage", "status_message",
    "endMessage", "end_message",
    "gameEndMessage", "game_end_message",
  ];
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
};

export const gameEndUserMessagesOrNull = (data: any, envelope: any): string | null => {
  const dataMsgs = apiMessagesJoinedOrNull(data);
  if (dataMsgs) return dataMsgs;
  
  const dataSingle = gameEndSingleStringOrNull(data);
  if (dataSingle) return dataSingle;

  if (envelope && envelope !== data) {
    const envMsgs = apiMessagesJoinedOrNull(envelope);
    if (envMsgs) return envMsgs;
    const envSingle = gameEndSingleStringOrNull(envelope);
    if (envSingle) return envSingle;
  }
  return null;
};

export const gameEndMessageForDisplay = (data: any, envelope: any, fallback: string): string => {
  const fb = applyWsMessagePlaceholders(fallback.trim(), data).trim();
  if (fb.length > 0) return gameEndSingleLine(fb);

  const raw = gameEndUserMessagesOrNull(data, envelope)?.trim() || "";
  if (raw.length === 0) return gameEndSingleLine(fb);

  const lines = raw.split('\n').map(t => t.trim()).filter(t => t.length > 0);
  const keyLines = lines.filter(l => hasKey(l) || englishApiLiteralToKey[normalizeEnglishApiLiteral(l)]);
  
  if (keyLines.length === 0) {
    return gameEndSingleLine(t("spectator_match_finished"));
  }

  const nonOutcome = keyLines.filter(l => !WS_GAME_END_OUTCOME_ONLY_KEYS.has(l));
  const toResolve = nonOutcome.length > 0 ? nonOutcome : keyLines;
  
  const mapped = formatApiMessagesBlockForDisplay(toResolve.join('\n'), "").trim();
  const resolved = applyWsMessagePlaceholders(mapped, data).trim();
  return gameEndSingleLine(resolved || t("spectator_match_finished"));
};
