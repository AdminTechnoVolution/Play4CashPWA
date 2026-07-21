import type { DominoTile } from '../../../data/models/ApiModels';

export type DominoBoardOrientation = 'horizontal' | 'vertical';
export type DominoBoardDirection = 'ltr' | 'rtl' | 'down';

export interface DominoBoardPlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: DominoBoardOrientation;
  direction: DominoBoardDirection;
  first: number;
  second: number;
}

export interface DominoBoardAnchor {
  x: number;
  y: number;
  value: number;
}

export interface DominoBoardLayout {
  width: number;
  height: number;
  placements: DominoBoardPlacement[];
  leftAnchor: DominoBoardAnchor;
  rightAnchor: DominoBoardAnchor;
}

export interface DominoBoardLayoutOptions {
  availableWidth: number;
  cellPx?: number;
  dividerPx?: number;
  tilePadding?: number;
  horizontalPadding?: number;
}

export interface DominoChainPips {
  towardPrev: number;
  towardNext: number;
}

/** Resolves the values that face the previous and next tile in server chain order. */
export function dominoChainPips(
  board: DominoTile[],
  leftEnd: number,
  rightEnd: number,
): DominoChainPips[] {
  if (board.length === 0) return [];

  let facingPrevious = leftEnd;
  return board.map((tile, index) => {
    const facingNext =
      index === board.length - 1
        ? rightEnd
        : tile.a === tile.b
          ? tile.a
          : tile.a === facingPrevious
            ? tile.b
            : tile.a;
    const result = { towardPrev: facingPrevious, towardNext: facingNext };
    facingPrevious = facingNext;
    return result;
  });
}

function placementSize(orientation: DominoBoardOrientation, shortSide: number, longSide: number) {
  return orientation === 'horizontal'
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function boxesOverlap(a: DominoBoardPlacement, b: DominoBoardPlacement): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Produces a compact, continuous tabletop chain. Logical order always follows the
 * server's left-to-right board. Horizontal runs alternate direction and a single
 * vertical tile joins consecutive runs at each bend.
 */
export function buildDominoBoardLayout(
  board: DominoTile[],
  leftEnd: number,
  rightEnd: number,
  options: DominoBoardLayoutOptions,
): DominoBoardLayout {
  const cellPx = options.cellPx ?? 20;
  const dividerPx = options.dividerPx ?? 2;
  const tilePadding = options.tilePadding ?? 3;
  const horizontalPadding = options.horizontalPadding ?? 4;
  const shortSide = cellPx + tilePadding * 2;
  const longSide = cellPx * 2 + dividerPx + tilePadding * 2;
  const usableWidth = Math.max(longSide * 2, options.availableWidth - horizontalPadding * 2);
  const tilesPerRun = Math.max(2, Math.floor((usableWidth - shortSide) / longSide));
  const chain = dominoChainPips(board, leftEnd, rightEnd);
  const placements: DominoBoardPlacement[] = [];

  let index = 0;
  let direction: 'ltr' | 'rtl' = 'ltr';
  let cursorX = 0;
  let rowY = 0;

  while (index < board.length) {
    const runLength = Math.min(tilesPerRun, board.length - index);
    const run: DominoBoardPlacement[] = [];

    for (let offset = 0; offset < runLength; offset += 1) {
      const tileIndex = index + offset;
      const tile = board[tileIndex];
      const pips = chain[tileIndex];
      const orientation: DominoBoardOrientation = tile.a === tile.b ? 'vertical' : 'horizontal';
      const size = placementSize(orientation, shortSide, longSide);
      const x = direction === 'ltr' ? cursorX : cursorX - size.width;
      const y = rowY - (size.height - shortSide) / 2;
      const placement: DominoBoardPlacement = {
        index: tileIndex,
        x,
        y,
        ...size,
        orientation,
        direction,
        first: direction === 'ltr' ? pips.towardPrev : pips.towardNext,
        second: direction === 'ltr' ? pips.towardNext : pips.towardPrev,
      };
      run.push(placement);
      placements.push(placement);
      cursorX = direction === 'ltr' ? x + size.width : x;
    }

    index += runLength;
    if (index >= board.length) break;

    // Keep the bend below the lowest tile in the completed run. This also keeps
    // vertical doubles at the end of a run from colliding with the bridge.
    const runBottom = Math.max(...run.map((tile) => tile.y + tile.height));
    const tile = board[index];
    const pips = chain[index];
    const bridgeX = direction === 'ltr' ? cursorX - shortSide : cursorX;
    const bridge: DominoBoardPlacement = {
      index,
      x: bridgeX,
      y: runBottom,
      width: shortSide,
      height: longSide,
      orientation: 'vertical',
      direction: 'down',
      first: pips.towardPrev,
      second: pips.towardNext,
    };
    placements.push(bridge);
    index += 1;

    rowY = bridge.y + longSide - shortSide;
    direction = direction === 'ltr' ? 'rtl' : 'ltr';
    cursorX = direction === 'rtl' ? bridge.x : bridge.x + shortSide;
  }

  if (placements.length === 0) {
    return {
      width: 0,
      height: 0,
      placements: [],
      leftAnchor: { x: 0, y: 0, value: leftEnd },
      rightAnchor: { x: 0, y: 0, value: rightEnd },
    };
  }

  const minX = Math.min(...placements.map((tile) => tile.x));
  const minY = Math.min(...placements.map((tile) => tile.y));
  const maxX = Math.max(...placements.map((tile) => tile.x + tile.width));
  const maxY = Math.max(...placements.map((tile) => tile.y + tile.height));
  const contentWidth = maxX - minX;
  const offsetX = horizontalPadding + Math.max(0, (usableWidth - contentWidth) / 2) - minX;
  const offsetY = -minY;

  for (const tile of placements) {
    tile.x += offsetX;
    tile.y += offsetY;
  }

  // Anchors point at the outer edge of each logical endpoint. They are consumed
  // by the UI controls without taking space inside the chain.
  const first = placements.find((tile) => tile.index === 0)!;
  const last = placements.find((tile) => tile.index === board.length - 1)!;
  const leftAnchor = {
    x: first.direction === 'rtl' ? first.x + first.width : first.x,
    y: first.y + first.height / 2,
    value: leftEnd,
  };
  const rightAnchor =
    last.direction === 'down'
      ? { x: last.x + last.width / 2, y: last.y + last.height, value: rightEnd }
      : {
          x: last.direction === 'ltr' ? last.x + last.width : last.x,
          y: last.y + last.height / 2,
          value: rightEnd,
        };

  // A development-time invariant that makes geometry regressions immediately visible.
  if (import.meta.env.DEV) {
    for (let a = 0; a < placements.length; a += 1) {
      for (let b = a + 1; b < placements.length; b += 1) {
        if (boxesOverlap(placements[a], placements[b])) {
          console.warn('[Domino] overlapping board tiles', placements[a].index, placements[b].index);
        }
      }
    }
  }

  return {
    width: usableWidth + horizontalPadding * 2,
    height: maxY - minY,
    placements,
    leftAnchor,
    rightAnchor,
  };
}
