import React from 'react';
import { ChessPieceType } from '../../../store/chessStore';

// Staunton chess pieces — cburnett set (same style as chess.com classic)
// Paths: public domain / CC-BY-SA, viewBox="0 0 45 45"

interface PieceProps { size: number; isSelected?: boolean }

function svg(size: number, isSelected: boolean | undefined, children: React.ReactNode) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 45 45"
      style={{
        display: 'block', overflow: 'visible',
        transform: isSelected ? 'scale(1.13)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        filter: isSelected
          ? 'drop-shadow(0 0 5px rgba(233,195,73,0.9))'
          : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
      }}
    >
      {children}
    </svg>
  );
}

const W = '#fff';
const B = '#202020';
const K = { stroke: '#000', strokeWidth: '1.5', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

/* ── WHITE PIECES ──────────────────────────────────────────────────────────── */

export function WhitePawn({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={W} {...K}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.09C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.41C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>
    </g>
  ));
}

export function WhiteKnight({ size, isSelected }: PieceProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      fontSize: size * 0.85,
      lineHeight: 1,
      color: W,
      WebkitTextStroke: '1px #000',
      textShadow: '0 0 2px #000, 0 1px 3px rgba(0,0,0,0.7)',
      transform: isSelected ? 'scale(1.13)' : 'scale(1)',
      transition: 'transform 0.1s ease',
      filter: isSelected ? 'drop-shadow(0 0 5px rgba(233,195,73,0.9))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
      userSelect: 'none',
    }}>
      ♞
    </span>
  );
}

export function WhiteBishop({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={W} {...K}>
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
      <path d="M17.5 26h10M15 32h15" stroke="#000" strokeWidth="1"/>
    </g>
  ));
}

export function WhiteRook({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={W} {...K}>
      <path d="M9 39h27v-3H9zM12.5 32l1.5-2.5h17l1.5 2.5z" strokeLinejoin="miter"/>
      <path d="M12 36v-4h21v4z" strokeLinejoin="miter"/>
      <path d="M14 29.5v-13h17v13z" strokeLinejoin="miter"/>
      <path d="M14 16.5L11 14h23l-3 2.5z" strokeLinejoin="miter"/>
      <path d="M11 14V9h4v2h5V9h5v2h5V9h4v5z" strokeLinejoin="miter"/>
    </g>
  ));
}

export function WhiteQueen({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={W} {...K}>
      <circle cx="6" cy="12" r="2.75"/>
      <circle cx="14" cy="9" r="2.75"/>
      <circle cx="22.5" cy="8" r="2.75"/>
      <circle cx="31" cy="9" r="2.75"/>
      <circle cx="39" cy="12" r="2.75"/>
      <path d="M9 26c8.5-8.5 21-8.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z" strokeLinejoin="miter"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/>
      <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" stroke="#000" strokeWidth="1"/>
    </g>
  ));
}

export function WhiteKing({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={W} {...K}>
      <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4v3.5-3.5c-2.5-7.5-12-10.5-16-4-3 6 5 10 5 10z"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#000" strokeWidth="1"/>
    </g>
  ));
}

/* ── BLACK PIECES ──────────────────────────────────────────────────────────── */

export function BlackPawn({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={B} {...K}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.09C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.41C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>
    </g>
  ));
}

export function BlackKnight({ size, isSelected }: PieceProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      fontSize: size * 0.85,
      lineHeight: 1,
      color: B,
      textShadow: '0 0 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.7)',
      transform: isSelected ? 'scale(1.13)' : 'scale(1)',
      transition: 'transform 0.1s ease',
      filter: isSelected ? 'drop-shadow(0 0 5px rgba(233,195,73,0.9))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
      userSelect: 'none',
    }}>
      ♞
    </span>
  );
}

export function BlackBishop({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={B} {...K}>
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
      <path d="M17.5 26h10M15 32h15" stroke="#fff" strokeWidth="1" strokeOpacity=".5"/>
    </g>
  ));
}

export function BlackRook({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={B} {...K}>
      <path d="M9 39h27v-3H9zM12.5 32l1.5-2.5h17l1.5 2.5z" strokeLinejoin="miter"/>
      <path d="M12 36v-4h21v4z" strokeLinejoin="miter"/>
      <path d="M14 29.5v-13h17v13z" strokeLinejoin="miter"/>
      <path d="M14 16.5L11 14h23l-3 2.5z" strokeLinejoin="miter"/>
      <path d="M11 14V9h4v2h5V9h5v2h5V9h4v5z" strokeLinejoin="miter"/>
      <path d="M9 39h27M12.5 32h20" stroke="#fff" strokeWidth=".8" strokeOpacity=".4"/>
    </g>
  ));
}

export function BlackQueen({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={B} {...K}>
      <circle cx="6" cy="12" r="2.75"/>
      <circle cx="14" cy="9" r="2.75"/>
      <circle cx="22.5" cy="8" r="2.75"/>
      <circle cx="31" cy="9" r="2.75"/>
      <circle cx="39" cy="12" r="2.75"/>
      <path d="M9 26c8.5-8.5 21-8.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5z" strokeLinejoin="miter"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/>
      <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c4-1.5 17-1.5 21 0" stroke="#fff" strokeWidth="1" strokeOpacity=".5"/>
    </g>
  ));
}

export function BlackKing({ size, isSelected }: PieceProps) {
  return svg(size, isSelected, (
    <g fill={B} {...K}>
      <path d="M22.5 11.63V6" stroke="#fff" strokeWidth="2.5" strokeLinejoin="miter"/>
      <path d="M20 8h5" stroke="#fff" strokeWidth="2.5" strokeLinejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4v3.5-3.5c-2.5-7.5-12-10.5-16-4-3 6 5 10 5 10z"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#fff" strokeWidth="1" strokeOpacity=".5"/>
    </g>
  ));
}

/* ── Unified export ─────────────────────────────────────────────────────────── */

const WHITE_MAP: Record<ChessPieceType, React.FC<PieceProps>> = {
  [ChessPieceType.KING]:   WhiteKing,
  [ChessPieceType.QUEEN]:  WhiteQueen,
  [ChessPieceType.ROOK]:   WhiteRook,
  [ChessPieceType.BISHOP]: WhiteBishop,
  [ChessPieceType.KNIGHT]: WhiteKnight,
  [ChessPieceType.PAWN]:   WhitePawn,
};

const BLACK_MAP: Record<ChessPieceType, React.FC<PieceProps>> = {
  [ChessPieceType.KING]:   BlackKing,
  [ChessPieceType.QUEEN]:  BlackQueen,
  [ChessPieceType.ROOK]:   BlackRook,
  [ChessPieceType.BISHOP]: BlackBishop,
  [ChessPieceType.KNIGHT]: BlackKnight,
  [ChessPieceType.PAWN]:   BlackPawn,
};

interface ChessPieceSvgProps {
  type: ChessPieceType;
  isWhite: boolean;
  size: number;
  isSelected?: boolean;
}

export function ChessPieceSvg({ type, isWhite, size, isSelected }: ChessPieceSvgProps) {
  const Component = isWhite ? WHITE_MAP[type] : BLACK_MAP[type];
  return <Component size={size} isSelected={isSelected} />;
}
