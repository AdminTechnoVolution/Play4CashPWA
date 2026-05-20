/** Percent position within the table ring (0–100). Index 0 = local player (home side). */
export type SeatSlot = { x: number; y: number };

/**
 * Seat rings around the felt for 2–10 players.
 * Slot 0 is always the current user (bottom / home side).
 */
export const UNO_SEAT_LAYOUTS: Record<number, SeatSlot[]> = {
  /** Face to face */
  2: [
    { x: 50, y: 86 },
    { x: 50, y: 12 },
  ],
  /** Bottom + two top corners */
  3: [
    { x: 50, y: 86 },
    { x: 18, y: 14 },
    { x: 82, y: 14 },
  ],
  /** One per corner (home = bottom-left) */
  4: [
    { x: 14, y: 82 },
    { x: 14, y: 14 },
    { x: 86, y: 14 },
    { x: 86, y: 82 },
  ],
  /** Bottom center + four corners */
  5: [
    { x: 50, y: 84 },
    { x: 12, y: 14 },
    { x: 88, y: 14 },
    { x: 88, y: 82 },
    { x: 12, y: 82 },
  ],
  /** Four corners + mid left / mid right (home = bottom-left corner) */
  6: [
    { x: 14, y: 82 },
    { x: 14, y: 14 },
    { x: 86, y: 14 },
    { x: 86, y: 82 },
    { x: 4, y: 50 },
    { x: 96, y: 50 },
  ],
  /** 3 top, 1 right, 2 bottom, 1 left */
  7: [
    { x: 50, y: 86 },
    { x: 26, y: 88 },
    { x: 22, y: 10 },
    { x: 50, y: 6 },
    { x: 78, y: 10 },
    { x: 94, y: 50 },
    { x: 6, y: 50 },
  ],
  /** 2 top, 2 right, 2 bottom, 2 left */
  8: [
    { x: 42, y: 86 },
    { x: 62, y: 88 },
    { x: 28, y: 8 },
    { x: 72, y: 8 },
    { x: 94, y: 32 },
    { x: 94, y: 68 },
    { x: 6, y: 68 },
    { x: 6, y: 32 },
  ],
  /** 3 top, 2 right, 2 bottom, 2 left */
  9: [
    { x: 50, y: 86 },
    { x: 74, y: 88 },
    { x: 22, y: 8 },
    { x: 50, y: 5 },
    { x: 78, y: 8 },
    { x: 94, y: 34 },
    { x: 94, y: 66 },
    { x: 6, y: 66 },
    { x: 6, y: 34 },
  ],
  /** 3 top, 2 right, 3 bottom, 2 left */
  10: [
    { x: 50, y: 88 },
    { x: 22, y: 90 },
    { x: 78, y: 90 },
    { x: 94, y: 70 },
    { x: 94, y: 30 },
    { x: 78, y: 8 },
    { x: 50, y: 5 },
    { x: 22, y: 8 },
    { x: 6, y: 30 },
    { x: 6, y: 70 },
  ],
};

/** Put `myUserId` in slot 0 so they always sit on the home side. */
export function orderPlayersForTable(playerOrder: string[], myUserId: string): string[] {
  const ids = playerOrder.filter((id) => id?.trim());
  const idx = ids.indexOf(myUserId);
  if (idx <= 0) return ids;
  return [...ids.slice(idx), ...ids.slice(0, idx)];
}

export function getSeatLayout(playerCount: number): SeatSlot[] {
  const n = Math.min(10, Math.max(2, playerCount));
  const layout = UNO_SEAT_LAYOUTS[n];
  if (layout) return layout;
  if (playerCount === 1) return [{ x: 50, y: 50 }];
  return UNO_SEAT_LAYOUTS[10];
}
