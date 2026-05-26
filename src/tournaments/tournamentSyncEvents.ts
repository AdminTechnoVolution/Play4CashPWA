import type { TournamentSummary } from '../data/models/ApiModels';

export const TOURNAMENT_PLACEMENT_CHECK_EVENT = 'p4c:tournament-placement-check';

export function dispatchTournamentPlacementCheck(tournament: TournamentSummary): void {
  window.dispatchEvent(
    new CustomEvent(TOURNAMENT_PLACEMENT_CHECK_EVENT, { detail: tournament }),
  );
}
