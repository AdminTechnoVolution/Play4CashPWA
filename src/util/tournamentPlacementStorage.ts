const SHOWN_KEY_PREFIX = 'p4c_tournament_placement_shown:';

export function hasTournamentPlacementShown(tournamentId: string): boolean {
  try {
    return sessionStorage.getItem(`${SHOWN_KEY_PREFIX}${tournamentId}`) === '1';
  } catch {
    return false;
  }
}

export function markTournamentPlacementShown(tournamentId: string): void {
  try {
    sessionStorage.setItem(`${SHOWN_KEY_PREFIX}${tournamentId}`, '1');
  } catch {
    /* ignore */
  }
}
