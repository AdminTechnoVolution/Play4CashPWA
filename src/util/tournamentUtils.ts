import type { TournamentBracketResponse, TournamentSummary } from '../data/models/ApiModels';
import { officialRemainingMs } from '../store/tournamentsStore';

const LIVE_STATUSES = new Set([
  'countdown',
  'locking',
  'running',
  'between_rounds',
  'finals_pending',
  'finals_running',
]);

const UPCOMING_STATUSES = new Set(['open', 'full', 'countdown', ...LIVE_STATUSES]);

const ACTIVE_MATCH_STATUSES = new Set(['ready', 'started', 'waiting_presence']);

export function isUserRegistered(t: TournamentSummary | null | undefined): boolean {
  if (!t?.myRegistration) return false;
  const s = t.myRegistration.status;
  return s !== 'refunded' && s !== 'eliminated';
}

export function canRegisterForTournament(t: TournamentSummary): boolean {
  if (isUserRegistered(t)) return false;
  if (t.status !== 'open') return false;
  return t.registeredCount < t.maxPlayers;
}

export function isLiveTournamentStatus(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

export function isMyUpcomingTournament(t: TournamentSummary): boolean {
  if (!isUserRegistered(t)) return false;
  if (t.status === 'finished' || t.status === 'cancelled' || t.status === 'draft') return false;
  return UPCOMING_STATUSES.has(t.status);
}

export function formatTournamentCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function tournamentUrgency(ms: number): 'normal' | 'soon' | 'imminent' | 'live' {
  if (ms <= 0) return 'live';
  if (ms <= 5 * 60_000) return 'imminent';
  if (ms <= 30 * 60_000) return 'soon';
  return 'normal';
}

export function gameAssetCode(socketCode: string): string {
  if (socketCode.includes('naval')) return 'battleship';
  return socketCode;
}

export function findMyMatchRoomId(
  bracket: TournamentBracketResponse | null | undefined,
  userId: string | undefined,
): string | null {
  if (!userId || !bracket) return null;
  const all = [...bracket.groupMatches, ...bracket.finalsMatches];
  const mine = all.find(
    (m) =>
      (m.playerA?.userId === userId || m.playerB?.userId === userId) &&
      m.roomId &&
      ACTIVE_MATCH_STATUSES.has(m.status),
  );
  return mine?.roomId ?? null;
}

export function pickPrimaryMyTournament(list: TournamentSummary[]): TournamentSummary | null {
  const mine = list.filter(isMyUpcomingTournament);
  if (mine.length === 0) return null;
  return [...mine].sort((a, b) => {
    const liveA = isLiveTournamentStatus(a.status) ? 0 : 1;
    const liveB = isLiveTournamentStatus(b.status) ? 0 : 1;
    if (liveA !== liveB) return liveA - liveB;
    return officialRemainingMs(a) - officialRemainingMs(b);
  })[0];
}

export function resolveJoinRoomId(
  tournament: TournamentSummary | null | undefined,
  bracket: TournamentBracketResponse | null | undefined,
  userId: string | undefined,
): string | null {
  if (tournament?.myActiveMatch?.canJoin && tournament.myActiveMatch.roomId) {
    return tournament.myActiveMatch.roomId;
  }
  return findMyMatchRoomId(bracket, userId);
}

export function tournamentStatusKey(status: string): string {
  return `tournament_status_${status}`;
}
