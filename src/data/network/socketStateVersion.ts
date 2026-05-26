/**
 * Detects gaps in server-pushed game state and triggers resync when versions skip.
 */
export type StateVersionTracker = {
  lastVersion: number;
  onGap: () => void;
};

export function createStateVersionTracker(onGap: () => void): StateVersionTracker {
  return { lastVersion: 0, onGap };
}

export function applyIncomingStateVersion(
  tracker: StateVersionTracker,
  incoming: { stateVersion?: number | null } | null | undefined,
): boolean {
  const v = incoming?.stateVersion;
  if (v == null || !Number.isFinite(v)) return true;

  if (tracker.lastVersion > 0 && v > tracker.lastVersion + 1) {
    tracker.onGap();
    tracker.lastVersion = v;
    return false;
  }

  if (v >= tracker.lastVersion) tracker.lastVersion = v;
  return true;
}

export function resetStateVersionTracker(tracker: StateVersionTracker): void {
  tracker.lastVersion = 0;
}
