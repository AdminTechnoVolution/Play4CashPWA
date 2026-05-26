import type {
  TournamentBracketGroup,
  TournamentBracketMatch,
  TournamentBracketResponse,
  TournamentHistoryItem,
  TournamentSummary,
} from '../data/models/ApiModels';
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

/** Participant can still be assigned to playable matches (not out of the tournament). */
const OUT_OF_TOURNAMENT_STATUSES = new Set([
  'eliminated',
  'forfeited',
  'refunded',
  'runner_up',
  'winner',
]);

export function isActiveTournamentPlayer(t: TournamentSummary | null | undefined): boolean {
  if (!t?.myRegistration) return false;
  return !OUT_OF_TOURNAMENT_STATUSES.has(t.myRegistration.status);
}

export function isUserEliminatedFromTournament(t: TournamentSummary | null | undefined): boolean {
  const s = t?.myRegistration?.status;
  return s === 'eliminated' || s === 'forfeited';
}

export function isUserRegistered(t: TournamentSummary | null | undefined): boolean {
  if (!t?.myRegistration) return false;
  const s = t.myRegistration.status;
  return s !== 'refunded' && s !== 'eliminated' && s !== 'forfeited';
}

export function canRegisterForTournament(t: TournamentSummary): boolean {
  if (isUserRegistered(t)) return false;
  if (t.status !== 'open') return false;
  return t.registeredCount < t.maxPlayers;
}

export function isLiveTournamentStatus(status: string): boolean {
  return LIVE_STATUSES.has(status);
}

/** Shown on the public tournaments catalog (excludes finished/cancelled/draft). */
export function isCatalogTournamentStatus(status: string): boolean {
  return status !== 'finished' && status !== 'cancelled' && status !== 'draft';
}

export function filterCatalogTournaments(list: TournamentSummary[]): TournamentSummary[] {
  return list.filter((t) => isCatalogTournamentStatus(t.status));
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

export function getTournamentMatchUiState(
  tournament: TournamentSummary | null | undefined,
): 'none' | 'lobby' | 'ready' {
  if (!isActiveTournamentPlayer(tournament)) return 'none';
  const m = tournament?.myActiveMatch;
  if (!m) return 'none';
  if (m.needsLobby) return 'lobby';
  if (m.canJoin && m.roomId) return 'ready';
  return 'none';
}

export function shouldShowTournamentMatchPanel(
  tournament: TournamentSummary | null | undefined,
): boolean {
  return getTournamentMatchUiState(tournament) !== 'none';
}

export function findMyMatchRoomId(
  bracket: TournamentBracketResponse | null | undefined,
  userId: string | undefined,
  tournament?: TournamentSummary | null,
): string | null {
  if (!isActiveTournamentPlayer(tournament ?? null)) return null;
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
): string | null {
  if (!isActiveTournamentPlayer(tournament)) return null;
  const m = tournament?.myActiveMatch;
  return m?.canJoin && m.roomId ? m.roomId : null;
}

export function isTournamentMatchReady(
  tournament: TournamentSummary | null | undefined,
): boolean {
  return getTournamentMatchUiState(tournament) === 'ready';
}

/** Live match UI (ready or lobby) — hide duplicate countdown/reminder cards. */
export function shouldFocusTournamentMatch(
  tournament: TournamentSummary | null | undefined,
): boolean {
  if (!tournament || !isLiveTournamentStatus(tournament.status)) return false;
  return shouldShowTournamentMatchPanel(tournament);
}

export function tournamentStatusKey(status: string): string {
  return `tournament_status_${status}`;
}

export function canSpectateTournamentMatch(status: string, roomId: string | null | undefined): boolean {
  return !!roomId && (status === 'started' || status === 'ready');
}

const DEFAULT_HOUSE_FEE_PERCENT = 10;
const DEFAULT_FIRST_PLACE_PERCENT = 70;

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Mirrors API settlement: 1st = gross × first%, 2nd = remainder after house fee. */
export function resolveTournamentPlacePrizes(
  t: Pick<
    TournamentSummary,
    | 'grossPrizePool'
    | 'houseFeePercent'
    | 'firstPlacePercent'
    | 'firstPlaceAmount'
    | 'secondPlaceAmount'
  >,
): { firstPlace: number; secondPlace: number } {
  const settledFirst = t.firstPlaceAmount ?? 0;
  const settledSecond = t.secondPlaceAmount ?? 0;
  if (settledFirst > 0 || settledSecond > 0) {
    return { firstPlace: settledFirst, secondPlace: settledSecond };
  }

  const gross = t.grossPrizePool ?? 0;
  const housePct = t.houseFeePercent ?? DEFAULT_HOUSE_FEE_PERCENT;
  const firstPct = t.firstPlacePercent ?? DEFAULT_FIRST_PLACE_PERCENT;
  const houseAmount = roundMoney(gross * (housePct / 100));
  const firstPlace = roundMoney(gross * (firstPct / 100));
  const secondPlace = roundMoney(Math.max(0, gross - houseAmount - firstPlace));
  return { firstPlace, secondPlace };
}

export type TournamentHistoryOutcomeStyle = { bg: string; color: string; labelKey: string };

export function tournamentHistoryOutcomeStyle(
  item: Pick<TournamentHistoryItem, 'status' | 'participantStatus'>,
): TournamentHistoryOutcomeStyle {
  if (item.status === 'cancelled') {
    if (item.participantStatus === 'refunded') {
      return {
        bg: 'rgba(138,155,191,0.15)',
        color: 'var(--sovereign-text-muted)',
        labelKey: 'tournament_history_result_refunded',
      };
    }
    return {
      bg: 'rgba(138,155,191,0.15)',
      color: 'var(--sovereign-text-muted)',
      labelKey: 'tournament_history_result_cancelled',
    };
  }
  if (item.participantStatus === 'winner') {
    return {
      bg: 'rgba(201,168,76,0.18)',
      color: 'var(--sovereign-gold)',
      labelKey: 'tournament_history_result_first',
    };
  }
  if (item.participantStatus === 'runner_up') {
    return {
      bg: 'rgba(176,190,197,0.16)',
      color: '#b0bec5',
      labelKey: 'tournament_history_result_second',
    };
  }
  if (item.participantStatus === 'forfeited') {
    return {
      bg: 'rgba(207,102,121,0.15)',
      color: 'var(--sovereign-error)',
      labelKey: 'tournament_history_result_forfeited',
    };
  }
  return {
    bg: 'rgba(138,155,191,0.15)',
    color: 'var(--sovereign-text-muted)',
    labelKey: 'tournament_history_result_eliminated',
  };
}

const MATCH_STATUS_KEYS: Record<string, string> = {
  pending: 'tournament_match_status_pending',
  waiting_presence: 'tournament_match_status_waiting_presence',
  ready: 'tournament_match_status_ready',
  started: 'tournament_match_status_started',
  finished: 'tournament_match_status_finished',
  forfeited: 'tournament_match_status_forfeited',
};

const ROUND_NAME_KEYS: Record<string, string> = {
  group_final: 'tournament_round_group_final',
  grand_final: 'tournament_round_grand_final',
  finals_semifinal: 'tournament_round_semifinal',
  finals_playin: 'tournament_round_playin',
};

export function formatTournamentMatchStatus(status: string, t: (key: string) => string): string {
  const key = MATCH_STATUS_KEYS[status.toLowerCase()];
  return key ? t(key) : status.replace(/_/g, ' ');
}

export function formatTournamentRoundName(roundName: string, t: (key: string) => string): string {
  const key = ROUND_NAME_KEYS[roundName.toLowerCase()];
  return key ? t(key) : roundName.replace(/_/g, ' ');
}

export function sortedBracketGroups(bracket: TournamentBracketResponse | null | undefined): TournamentBracketGroup[] {
  if (!bracket?.groups?.length) {
    const fromMatches = new Set(
      (bracket?.groupMatches ?? []).map((m) => m.groupNumber).filter((n): n is number => n != null),
    );
    return [...fromMatches]
      .sort((a, b) => a - b)
      .map((groupNumber) => ({ groupNumber, status: 'pending', winnerUserId: null, participants: [] }));
  }
  return [...bracket.groups].sort((a, b) => a.groupNumber - b.groupNumber);
}

export function bracketHasMatchContent(bracket: TournamentBracketResponse | null | undefined): boolean {
  if (!bracket) return false;
  return bracket.groupMatches.length > 0 || bracket.finalsMatches.length > 0;
}

export function bracketHasVisibleContent(bracket: TournamentBracketResponse | null | undefined): boolean {
  if (!bracket) return false;
  if (bracketHasMatchContent(bracket)) return true;
  return (bracket.groups ?? []).some((g) => (g.participants?.length ?? 0) > 0);
}

export function groupParticipantsFor(
  group: TournamentBracketGroup | null | undefined,
): NonNullable<TournamentBracketGroup['participants']> {
  return group?.participants ?? [];
}

export function groupMatchesByRound(matches: TournamentBracketMatch[]): Array<{
  roundIndex: number;
  roundName: string;
  matches: TournamentBracketMatch[];
}> {
  const byRound = new Map<number, TournamentBracketMatch[]>();
  for (const m of matches) {
    const ri = m.roundIndex ?? 0;
    if (!byRound.has(ri)) byRound.set(ri, []);
    byRound.get(ri)!.push(m);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([roundIndex, roundMatches]) => ({
      roundIndex,
      roundName: roundMatches[0]?.roundName ?? '',
      matches: [...roundMatches].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0)),
    }));
}

export function usernameForUserId(
  bracket: TournamentBracketResponse | null | undefined,
  userId: string | null | undefined,
): string | null {
  if (!bracket || !userId) return null;
  for (const g of bracket.groups ?? []) {
    const p = g.participants?.find((x) => x.userId === userId);
    if (p) return p.username;
  }
  const all = [...bracket.groupMatches, ...bracket.finalsMatches];
  for (const m of all) {
    if (m.playerA?.userId === userId) return m.playerA.username;
    if (m.playerB?.userId === userId) return m.playerB.username;
  }
  return null;
}

export function isMyBracketMatch(
  match: TournamentBracketMatch,
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  return match.playerA?.userId === userId || match.playerB?.userId === userId;
}

export function canJoinBracketMatch(
  match: TournamentBracketMatch,
  tournament: TournamentSummary | null | undefined,
  userId: string | undefined,
): boolean {
  if (!userId || !tournament?.myActiveMatch) return false;
  if (tournament.myActiveMatch.matchId !== match.id) return false;
  return !!(tournament.myActiveMatch.canJoin && tournament.myActiveMatch.roomId);
}
