import React from 'react';

/** Android DominoScreen.kt — warm ivory, brown border, navy pips, brown divider */
const TILE_FACE = '#FAFAF0';
const TILE_BORDER = '#795548';
const TILE_PIP = '#1A237E';
const TILE_DIVIDER = '#8D6E63';
const TILE_SELECTED = '#c9a84c';
const TILE_PLAYABLE = '#43A047';
const END_LEFT = '#42A5F5';
const END_RIGHT = '#66BB6A';
const END_ACTIVE = '#c9a84c';

const DIVIDER_PX = 2;
const TILE_PAD = 3;

/** Normalized pip positions within a unit square (matches Android PIP_POSITIONS). */
const PIP_POS: [number, number][][] = [
  [],
  [[0.5, 0.5]],
  [
    [0.73, 0.27],
    [0.27, 0.73],
  ],
  [
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
  ],
  [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  [
    [0.27, 0.22],
    [0.27, 0.5],
    [0.27, 0.78],
    [0.73, 0.22],
    [0.73, 0.5],
    [0.73, 0.78],
  ],
];

function PipFace({ count, cellPx, color }: { count: number; cellPx: number; color: string }) {
  const n = Math.max(0, Math.min(6, count));
  const pts = PIP_POS[n] || [];
  const r = cellPx * 0.14;
  return (
    <div style={{ position: 'relative', width: cellPx, height: cellPx }}>
      {pts.map(([nx, ny], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${nx * 100}%`,
            top: `${ny * 100}%`,
            width: r * 2,
            height: r * 2,
            marginLeft: -r,
            marginTop: -r,
            borderRadius: '50%',
            background: color,
          }}
        />
      ))}
    </div>
  );
}

export type TileOrientation = 'horizontal' | 'vertical';

interface DominoVizTileProps {
  left: number;
  right: number;
  cellPx: number;
  orientation: TileOrientation;
  borderColor?: string;
  borderWidth?: number;
  highlight?: boolean;
  dimAlpha?: number;
  onClick?: () => void;
}

export function DominoVizTile({
  left,
  right,
  cellPx,
  orientation,
  borderColor = TILE_BORDER,
  borderWidth = 1,
  highlight = false,
  dimAlpha = 1,
  onClick,
}: DominoVizTileProps) {
  const effBorder = highlight ? TILE_SELECTED : borderColor;
  const effW = highlight ? 2.5 : borderWidth;
  const w =
    orientation === 'horizontal'
      ? cellPx * 2 + DIVIDER_PX + TILE_PAD * 2
      : cellPx + TILE_PAD * 2;
  const h =
    orientation === 'horizontal'
      ? cellPx + TILE_PAD * 2
      : cellPx * 2 + DIVIDER_PX + TILE_PAD * 2;

  const face = (
    <div
      onClick={onClick}
      style={{
        width: w,
        height: h,
        padding: TILE_PAD,
        borderRadius: 5,
        background: TILE_FACE,
        border: `${effW}px solid ${effBorder}`,
        boxShadow: highlight ? '0 4px 14px rgba(201,168,76,0.45)' : '0 1px 3px rgba(0,0,0,0.35)',
        opacity: dimAlpha,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {orientation === 'horizontal' ? (
        <>
          <PipFace count={left} cellPx={cellPx} color={TILE_PIP} />
          <div style={{ width: DIVIDER_PX / 2 }} />
          <div style={{ width: DIVIDER_PX, height: cellPx, background: TILE_DIVIDER, flexShrink: 0 }} />
          <div style={{ width: DIVIDER_PX / 2 }} />
          <PipFace count={right} cellPx={cellPx} color={TILE_PIP} />
        </>
      ) : (
        <>
          <PipFace count={left} cellPx={cellPx} color={TILE_PIP} />
          <div style={{ height: DIVIDER_PX / 2 }} />
          <div style={{ height: DIVIDER_PX, width: cellPx, background: TILE_DIVIDER, flexShrink: 0 }} />
          <div style={{ height: DIVIDER_PX / 2 }} />
          <PipFace count={right} cellPx={cellPx} color={TILE_PIP} />
        </>
      )}
    </div>
  );

  return face;
}

/** Board: doubles vertical, rest horizontal (Android BoardTile). */
export function BoardTileViz({
  left,
  right,
  cellPx = 20,
  highlight = false,
}: {
  left: number;
  right: number;
  cellPx?: number;
  highlight?: boolean;
}) {
  const isDouble = left === right;
  return (
    <DominoVizTile
      left={left}
      right={right}
      cellPx={cellPx}
      orientation={isDouble ? 'vertical' : 'horizontal'}
      highlight={highlight}
    />
  );
}

/** Hand tiles: always vertical (Android HandTile). */
export function HandTileViz({
  left,
  right,
  cellPx = 18,
  isSelected,
  isPlayable,
  isPlayerTurn,
  dimUnplayable,
  onClick,
}: {
  left: number;
  right: number;
  cellPx?: number;
  isSelected: boolean;
  isPlayable: boolean;
  isPlayerTurn: boolean;
  /** When it is the player's turn but this tile cannot be played (Android dim). */
  dimUnplayable?: boolean;
  onClick?: () => void;
}) {
  let borderColor = TILE_BORDER;
  let borderW = 1;
  if (isSelected) {
    borderColor = TILE_SELECTED;
    borderW = 2.5;
  } else if (isPlayable && isPlayerTurn) {
    borderColor = TILE_PLAYABLE;
    borderW = 2;
  }
  const dim = !isPlayerTurn ? 0.5 : dimUnplayable ? 0.45 : 1;

  return (
    <div
      style={{
        display: 'inline-flex',
        transform: isSelected ? 'rotate(-4deg)' : undefined,
        transition: 'transform 0.15s ease',
      }}
    >
      <DominoVizTile
        left={left}
        right={right}
        cellPx={cellPx}
        orientation="vertical"
        borderColor={borderColor}
        borderWidth={borderW}
        dimAlpha={dim}
        onClick={onClick}
      />
    </div>
  );
}

/** L/R open end indicators (Android EndIndicator). */
export function EndIndicatorViz({
  value,
  isLeft,
  active,
}: {
  value: number;
  isLeft: boolean;
  active: boolean;
}) {
  const base = isLeft ? END_LEFT : END_RIGHT;
  const bg = active ? END_ACTIVE : base;
  const pipColor = active ? '#1a1a1a' : '#fff';
  const cell = 18;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 5px',
        borderRadius: 6,
        background: bg,
        border: active ? '2px solid rgba(255,255,255,0.7)' : 'none',
        boxShadow: active ? '0 2px 8px rgba(201,168,76,0.4)' : '0 1px 2px rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 800, color: pipColor, opacity: 0.85 }}>{isLeft ? 'L' : 'R'}</span>
      <PipFace count={value} cellPx={cell} color={pipColor} />
    </div>
  );
}

export { TILE_FACE, TILE_BORDER, TILE_PIP, END_LEFT, END_RIGHT };
