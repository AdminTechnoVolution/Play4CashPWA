import type { TournamentSummary } from '../data/models/ApiModels';
import {
  isLiveTournamentStatus,
  isMyUpcomingTournament,
  pickPrimaryMyTournament,
} from '../util/tournamentUtils';

export type TournamentSyncFocus =
  | { kind: 'background' }
  | { kind: 'detail'; tournamentId: string }
  | { kind: 'bracket'; tournamentId: string };

export interface TournamentSyncTickPlan {
  /** ms until the next scheduler tick */
  delayMs: number;
  refreshMine: boolean;
  hydratePrimaryLive: boolean;
  primaryDetailId: string | null;
  primaryBracketId: string | null;
  focusDetailId: string | null;
  focusBracketId: string | null;
  checkPlacements: boolean;
}

const MS = {
  focus: 12_000,
  focusWithSocket: 60_000,
  live: 30_000,
  liveWithSocket: 90_000,
  registered: 60_000,
  idle: 120_000,
  placement: 90_000,
  hiddenMultiplier: 4,
} as const;

const PRE_LIVE_SOCKET_STATUSES = new Set(['open', 'full', 'countdown']);

/** Tournament lobby UI (match join panel). */
export function needsTournamentLobby(t: TournamentSummary | null | undefined): boolean {
  if (!t || !isMyUpcomingTournament(t)) return false;
  return isLiveTournamentStatus(t.status) || !!t.myActiveMatch?.needsLobby;
}

/** Keep WS connected for live lobby and pre-start bracket roster updates. */
export function needsTournamentSocketConnection(t: TournamentSummary | null | undefined): boolean {
  if (!t || !isMyUpcomingTournament(t)) return false;
  if (needsTournamentLobby(t)) return true;
  return PRE_LIVE_SOCKET_STATUSES.has(t.status);
}

export function pickSocketTournament(
  focus: TournamentSyncFocus,
  myList: TournamentSummary[],
  catalogList: TournamentSummary[],
): TournamentSummary | null {
  const source = myList.length > 0 ? myList : catalogList;
  if (focus.kind !== 'background') {
    const focused = source.find((t) => t.id === focus.tournamentId);
    if (focused && needsTournamentSocketConnection(focused)) return focused;
  }
  const primary = pickPrimaryMyTournament(source);
  if (primary && needsTournamentSocketConnection(primary)) return primary;
  return null;
}

export function planTournamentSyncTick(input: {
  visible: boolean;
  focus: TournamentSyncFocus;
  myList: TournamentSummary[];
  catalogList: TournamentSummary[];
  lastPlacementCheckAt: number;
  lobbySocketConnected: boolean;
  socketTournamentId: string | null;
  now?: number;
}): TournamentSyncTickPlan {
  const now = input.now ?? Date.now();
  const hiddenMult = input.visible ? 1 : MS.hiddenMultiplier;
  const source = input.myList.length > 0 ? input.myList : input.catalogList;
  const primary = pickPrimaryMyTournament(source);
  const livePrimary = primary && needsTournamentLobby(primary);

  const wsCoversPrimary =
    input.lobbySocketConnected &&
    input.socketTournamentId != null &&
    primary?.id === input.socketTournamentId;

  const focusTournamentId =
    input.focus.kind === 'detail' || input.focus.kind === 'bracket' ? input.focus.tournamentId : null;

  const wsCoversFocus =
    input.lobbySocketConnected &&
    input.socketTournamentId != null &&
    focusTournamentId != null &&
    focusTournamentId === input.socketTournamentId;

  let baseDelay: number = MS.idle;
  if (input.focus.kind !== 'background') {
    baseDelay = wsCoversFocus ? MS.focusWithSocket : MS.focus;
  } else if (livePrimary) {
    baseDelay = wsCoversPrimary ? MS.liveWithSocket : MS.live;
  } else if (input.myList.some(isMyUpcomingTournament)) {
    baseDelay = MS.registered;
  }

  const checkPlacements = now - input.lastPlacementCheckAt >= MS.placement;

  const focusDetailId = focusTournamentId;
  const focusBracketId = focusTournamentId;

  const primaryDetailId = livePrimary && input.focus.kind === 'background' ? primary!.id : null;
  const primaryBracketId = livePrimary && input.focus.kind === 'background' ? primary!.id : null;

  return {
    delayMs: baseDelay * hiddenMult,
    refreshMine: true,
    hydratePrimaryLive: !!livePrimary && input.focus.kind === 'background' && !wsCoversPrimary,
    primaryDetailId: wsCoversPrimary ? null : primaryDetailId,
    primaryBracketId: wsCoversPrimary ? null : primaryBracketId,
    focusDetailId: wsCoversFocus ? null : focusDetailId,
    focusBracketId: wsCoversFocus ? null : focusBracketId,
    checkPlacements,
  };
}

export const tournamentSyncIntervals = MS;
