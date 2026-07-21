import { describe, expect, it } from 'vitest';
import type { DominoTile } from '../../../data/models/ApiModels';
import { buildDominoBoardLayout, dominoChainPips } from './dominoBoardLayout';

const CELL = 20;
const SHORT = 26;
const LONG = 48;

function layout(board: DominoTile[], width = 360) {
  return buildDominoBoardLayout(board, board[0]?.a ?? -1, board[board.length - 1]?.b ?? -1, {
    availableWidth: width,
    cellPx: CELL,
    horizontalPadding: 36,
  });
}

function overlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function touches(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  const horizontalContact =
    (a.x + a.width === b.x || b.x + b.width === a.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
  const verticalContact =
    (a.y + a.height === b.y || b.y + b.height === a.y) &&
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x);
  return horizontalContact || verticalContact;
}

describe('domino board layout', () => {
  it('centers a single tile and keeps its real dimensions', () => {
    const result = layout([{ a: 2, b: 5 }]);
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ orientation: 'horizontal', width: LONG, height: SHORT });
    expect(result.leftAnchor.value).toBe(2);
    expect(result.rightAnchor.value).toBe(5);
  });

  it('orients values so every touching pair matches', () => {
    const board = [
      { a: 1, b: 3 },
      { a: 3, b: 6 },
      { a: 6, b: 2 },
      { a: 2, b: 4 },
    ];
    const pips = dominoChainPips(board, 1, 4);
    expect(pips.map((pip) => [pip.towardPrev, pip.towardNext])).toEqual([
      [1, 3],
      [3, 6],
      [6, 2],
      [2, 4],
    ]);
  });

  it('places doubles perpendicular while preserving a continuous run', () => {
    const result = layout([
      { a: 1, b: 3 },
      { a: 3, b: 3 },
      { a: 3, b: 6 },
    ]);
    const [first, double, last] = result.placements;
    expect(double).toMatchObject({ orientation: 'vertical', width: SHORT, height: LONG });
    expect(first.x + first.width).toBe(double.x);
    expect(double.x + double.width).toBe(last.x);
  });

  it('creates alternating connected runs on narrow boards', () => {
    const board: DominoTile[] = [
      { a: 0, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 4 },
      { a: 4, b: 5 }, { a: 5, b: 6 }, { a: 6, b: 0 }, { a: 0, b: 2 },
      { a: 2, b: 5 }, { a: 5, b: 1 }, { a: 1, b: 4 }, { a: 4, b: 6 },
    ];
    const result = layout(board, 210);
    expect(result.placements.some((tile) => tile.direction === 'down')).toBe(true);
    expect(result.placements.some((tile) => tile.direction === 'rtl')).toBe(true);
    expect(new Set(result.placements.map((tile) => tile.y)).size).toBeGreaterThan(2);
    expect(result.width).toBeLessThanOrEqual(210);
    const logicalOrder = [...result.placements].sort((a, b) => a.index - b.index);
    for (let index = 1; index < logicalOrder.length; index += 1) {
      expect(touches(logicalOrder[index - 1], logicalOrder[index])).toBe(true);
    }
  });

  it.each([210, 360, 768])('keeps tiles inside the container without overlaps at %ipx', (width) => {
    const board: DominoTile[] = [
      { a: 0, b: 0 }, { a: 0, b: 1 }, { a: 1, b: 1 }, { a: 1, b: 2 },
      { a: 2, b: 3 }, { a: 3, b: 3 }, { a: 3, b: 4 }, { a: 4, b: 5 },
      { a: 5, b: 5 }, { a: 5, b: 6 }, { a: 6, b: 2 }, { a: 2, b: 2 },
    ];
    const result = layout(board, width);
    for (const tile of result.placements) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(result.width);
    }
    for (let i = 0; i < result.placements.length; i += 1) {
      for (let j = i + 1; j < result.placements.length; j += 1) {
        expect(overlap(result.placements[i], result.placements[j])).toBe(false);
      }
    }
  });
});
