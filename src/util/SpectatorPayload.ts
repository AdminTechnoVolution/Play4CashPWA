import { 
  gameEndMessageForDisplay,
  normalizedGameEndReason, 
  GAME_END_OPPONENT_DISCONNECT_REASONS, 
  GAME_END_OWN_TIMEOUT_REASONS, 
  GAME_END_OPPONENT_TIMEOUT_REASONS,
  playerGameEndReasonFallback,
  PlayerGameEndReasonProfile
} from '../i18n/ApiMessageDisplay';
import { GameOverPayload } from '../data/models/ApiModels';

export interface SpectatorSeat {
  userId: string;
  displayName: string;
}

const shotMoveContainers = [
  "shot", "lastShot", "fire", "last_fire", "move", "lastMove", "pass", "lastPass",
];

const usernameFromJsonObject = (o: any): string => {
  return (o.username || o.userName || o.displayName || o.name || "").toString().trim();
};

const fromObject = (data: any, key: string): string | null => {
  const o = data[key];
  if (o && typeof o === 'object') {
    const name = usernameFromJsonObject(o);
    if (name.length > 0) return name;
  }
  return null;
};

export const SpectatorPayload = {
  parseSeats: (data: any): SpectatorSeat[] => {
    const arr = data.players;
    if (!Array.isArray(arr)) return [];
    const out: SpectatorSeat[] = [];
    for (const o of arr) {
      if (!o) continue;
      const pid = o.playerId || {};
      const user = o.user || {};
      const id = (pid._id || pid.id || user._id || user.id || "").toString();
      let name = (pid.username || user.username || "").toString().trim();
      if (!name && id) name = id;
      if (id || name) {
        out.push({ userId: id, displayName: name || id });
      }
    }
    return out;
  },

  currentTurnUsername: (data: any): string => {
    return (
      data.currentTurnUsername ||
      data.current_turn_username ||
      data.currentPlayerUsername ||
      data.current_player_username ||
      data.currentPlayer ||
      data.current_player ||
      data.userName ||
      data.username ||
      data.user_name ||
      data.displayName ||
      data.display_name ||
      data.playerName ||
      data.player_name ||
      ""
    ).toString().trim();
  },

  optPlayerSlot: (data: any, oneBased: number): string => {
    const keys = [`player${oneBased}`, `player_${oneBased}`];
    for (const k of keys) {
      const v = (data[k] || "").toString().trim();
      if (v.length > 0) return v;
    }
    return "";
  },

  creatorOpponentUsernames: (data: any): [string, string] | null => {
    const a = (SpectatorPayload.optPlayerSlot(data, 1) || data.attackerUsername || data.attacker_username || "").toString().trim();
    const d = (SpectatorPayload.optPlayerSlot(data, 2) || data.defenderUsername || data.defender_username || "").toString().trim();
    return (a.length > 0 && d.length > 0) ? [a, d] : null;
  },

  dominoSpectatorPlayerNames: (data: any): string[] => {
    const slots = [1, 2, 3, 4].map(idx => SpectatorPayload.optPlayerSlot(data, idx)).filter(s => s.length > 0);
    if (slots.length >= 2) return slots;
    const seats = SpectatorPayload.parseSeats(data).map(s => s.displayName || s.userId).filter(n => n.length > 0);
    if (seats.length >= 2) return seats;
    const co = SpectatorPayload.creatorOpponentUsernames(data);
    return co ? [co[0], co[1]] : [];
  },

  seatIndexToUsername: (data: any, idx: number): string | null => {
    if (idx < 0) return null;
    const dom = SpectatorPayload.dominoSpectatorPlayerNames(data);
    if (idx < dom.length) return dom[idx];
    const co = SpectatorPayload.creatorOpponentUsernames(data);
    if (co) {
      if (idx === 0) return co[0];
      if (idx === 1) return co[1];
    }
    return null;
  },

  resolveNamedPlayerField: (data: any, camelKey: string, snakeKey: string): string => {
    const fromObj = fromObject(data, camelKey) || fromObject(data, snakeKey);
    if (fromObj) return fromObj;

    const val = data[camelKey];
    if (typeof val === 'string') {
      const t = val.trim();
      if (t.length > 0) return t;
    } else if (typeof val === 'number') {
      const n = SpectatorPayload.seatIndexToUsername(data, val);
      if (n) return n;
    }

    const raw = (data[camelKey] || "").toString().trim();
    if (raw.length > 0 && !raw.startsWith('{')) return raw;
    const rawSnake = (data[snakeKey] || "").toString().trim();
    if (rawSnake.length > 0 && !rawSnake.startsWith('{')) return rawSnake;

    for (const container of shotMoveContainers) {
      const o = data[container];
      if (o && typeof o === 'object') {
        const nested = (o[camelKey] || o[snakeKey] || "").toString().trim();
        if (nested.length > 0 && !nested.startsWith('{')) return nested;
        const nestedObj = fromObject(o, camelKey) || fromObject(o, snakeKey);
        if (nestedObj) return nestedObj;
      }
    }

    if (data[camelKey] !== undefined) {
      const idx = parseInt(data[camelKey]);
      if (!isNaN(idx)) {
        const n = SpectatorPayload.seatIndexToUsername(data, idx);
        if (n) return n;
      }
    }
    if (data[snakeKey] !== undefined) {
      const idx = parseInt(data[snakeKey]);
      if (!isNaN(idx)) {
        const n = SpectatorPayload.seatIndexToUsername(data, idx);
        if (n) return n;
      }
    }

    return "";
  },

  spectatorTurnHolderUsername: (data: any): string => {
    // Strictly prioritize turnOf as per the API's active behavior during moves
    const turnOf = SpectatorPayload.resolveNamedPlayerField(data, "turnOf", "turn_of");
    if (turnOf.length > 0) return turnOf;
    
    // Fallbacks only for initialization/edge cases
    const shotFrom = SpectatorPayload.resolveNamedPlayerField(data, "shotFrom", "shot_from");
    if (shotFrom.length > 0) return shotFrom;
    
    const currentPlayer = SpectatorPayload.resolveNamedPlayerField(data, "currentPlayer", "current_player");
    if (currentPlayer.length > 0) return currentPlayer;

    return SpectatorPayload.currentTurnUsername(data);
  },

  seatsForSpectatorSummary: (data: any): SpectatorSeat[] => {
    const parsed = SpectatorPayload.parseSeats(data);
    if (parsed.length >= 2) return parsed;
    const dom = SpectatorPayload.dominoSpectatorPlayerNames(data);
    if (dom.length >= 2) {
      return dom.map(n => ({ userId: n, displayName: n }));
    }
    const co = SpectatorPayload.creatorOpponentUsernames(data);
    if (co) {
      return [
        { userId: co[0], displayName: co[0] },
        { userId: co[1], displayName: co[1] },
      ];
    }
    return parsed;
  },

  whiteBlackDisplayNames: (data: any, seats: SpectatorSeat[]): [string, string] => {
    let w = (data.whiteUsername || data.white_player_username || data.whitePlayerName || data.white_player_name || "").toString().trim();
    let b = (data.blackUsername || data.black_player_username || data.blackPlayerName || data.black_player_name || "").toString().trim();
    if (w.length === 0 && seats.length > 0) w = seats[0].displayName;
    if (b.length === 0 && seats.length > 1) b = seats[1].displayName;
    return [w, b];
  },

  fallbackPlayerName: (oneBasedIndex: number): string => {
    return `spectator_player_n|${oneBasedIndex}`; // Returning key with placeholder info
  },

  spectatorEndReasonFallback: (data: any, outcomeRaw: string): string => {
    const reason = normalizedGameEndReason(data);
    const o = outcomeRaw.trim().toLowerCase();
    switch (true) {
      case o === "draw" || o === "stalemate" || reason === "stalemate" || reason === "draw":
        return "spectator_match_draw_result";
      case o === "insufficient_material" || reason === "insufficient_material":
        return "spectator_end_insufficient_material";
      case o === "opponent_disconnected" || GAME_END_OPPONENT_DISCONNECT_REASONS.has(reason):
        return "spectator_end_disconnected";
      case o === "forfeit" || reason === "forfeit":
        return "spectator_end_forfeit";
      case o === "timeout_loss" || GAME_END_OWN_TIMEOUT_REASONS.has(reason) || GAME_END_OPPONENT_TIMEOUT_REASONS.has(reason):
        return "spectator_end_timeout";
      case o === "checkmate" || reason === "checkmate":
        return "spectator_end_checkmate";
      case o === "win" || o === "lose":
        return "spectator_end_decisive";
      default:
        return "spectator_match_finished";
    }
  },

  gameEndWinnerDisplayName: (winnerId: string | null, seats: SpectatorSeat[]): string | null => {
    const wid = (winnerId || "").trim();
    if (wid.length === 0) return null;
    const byId = seats.find(s => s.userId === wid);
    if (byId && byId.displayName) return byId.displayName;
    const byName = seats.find(s => s.displayName.toLowerCase() === wid.toLowerCase());
    if (byName && byName.displayName) return byName.displayName;
    return wid;
  },

  spectatorGameEndReasonStatusMessage: (envelope: any, data: any, outcomeRaw: string): string => {
    const rf = SpectatorPayload.spectatorEndReasonFallback(data, outcomeRaw);
    return gameEndMessageForDisplay(data, envelope, rf);
  },

  /**
   * Standard turn and name extraction logic (Battleship Standard).
   * Mirrors extractSpectatorNamesFromPayload in battleshipStore.ts.
   */
  extractStandardTurnAndNames: (data: any): { p1: string; p2: string; turnHolder: string } => {
    let p1 = '';
    let p2 = '';

    // Priority 1: explicit player slots
    const p1Slot = (data.player1 || data.player_1 || data.attackerUsername || data.attacker_username || "").toString().trim();
    const p2Slot = (data.player2 || data.player_2 || data.defenderUsername || data.defender_username || "").toString().trim();
    if (p1Slot) p1 = p1Slot;
    if (p2Slot) p2 = p2Slot;

    // Priority 2: players roster array
    if (!p1 || !p2) {
      const players = data.players || [];
      if (Array.isArray(players)) {
        players.forEach((e: any, idx: number) => {
          const u = e.playerId?.username || e.user?.username || e.username || "";
          const username = u.toString().trim();
          if (idx === 0 && !p1 && username) p1 = username;
          if (idx === 1 && !p2 && username) p2 = username;
        });
      }
    }

    // Turn holder priority: turnOf → shot_from → isTurnOf → currentTurnUsername → currentPlayer
    const turnHolder = (
      data.turnOf ||
      data.turn_of ||
      data.shotFrom ||
      data.shot_from ||
      data.isTurnOf ||
      data.is_turn_of ||
      data.currentTurnUsername ||
      data.current_turn_username ||
      data.currentPlayer ||
      ""
    ).toString().trim();

    return { p1, p2, turnHolder };
  },

  /**
   * Standard game-over resolution logic (Battleship Standard).
   * Mirrors deriveGameOver in battleshipStore.ts.
   */
  resolveStandardGameOver: (data: any, myUsername: string, isSpectator: boolean, profile: PlayerGameEndReasonProfile): GameOverPayload => {
    const outcome = data.outcome || "";
    // Android match end outcomes: win, lose, draw, forfeit, timeout_loss, opponent_disconnected
    const isDraw = outcome === "draw" || !!data.isDraw;
    const youWon = !isSpectator && (
      outcome === "win" ||
      ((outcome === "forfeit" || outcome === "opponent_disconnected") && (data.youWon || data.you_won || false))
    );

    const prize = typeof data.prize === 'number' ? data.prize : undefined;
    let winner = typeof data.winner === 'string' ? data.winner : undefined;

    if (isSpectator && !isDraw) {
      const names = SpectatorPayload.extractStandardTurnAndNames(data);
      if (winner === names.p1) winner = names.p1;
      else if (winner === names.p2) winner = names.p2;
      else if (data.winner) {
         winner = data.winner === "mine" ? names.p1 : (names.p2 || data.winner);
      }
    }

    // Resolve robust translated reason using fallback helper (handles forfeit -> localized string)
    const reason = playerGameEndReasonFallback(data, outcome, youWon, isDraw, profile, isSpectator);

    return {
      outcome: isDraw ? "draw" : youWon ? "win" : "lose",
      youWon,
      isDraw,
      winner: winner || (youWon ? "You" : "Opponent"),
      reason,
      prize,
    };
  },
};
