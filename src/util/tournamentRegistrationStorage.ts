const STORAGE_KEY = 'p4c_registered_tournament_ids';

export function trackRegisteredTournament(id: string): void {
  try {
    const ids = new Set(readTrackedTournamentIds());
    ids.add(id);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function untrackRegisteredTournament(id: string): void {
  try {
    const ids = readTrackedTournamentIds().filter((x) => x !== id);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function readTrackedTournamentIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
