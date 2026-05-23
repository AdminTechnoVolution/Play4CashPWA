import type { ConnectFourCell } from '../../../data/models/connectFourModels';

export const CF_ROWS = 6;
export const CF_COLS = 7;

/** Lowest empty row in a column (5 = bottom), or -1 if full. */
export function findDropRow(board: ConnectFourCell[][], col: number): number {
  if (col < 0 || col >= CF_COLS) return -1;
  for (let row = CF_ROWS - 1; row >= 0; row--) {
    if (!board[row]?.[col]) return row;
  }
  return -1;
}
