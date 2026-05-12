import type { CSSProperties } from 'react';
import type { UnoCardCode } from '../../../data/models/ApiModels';
import { parseUnoCard, UNO_COLOR_BG, UNO_COLOR_BG_DARK } from './unoCardModel';

interface UnoCardProps {
  code: UnoCardCode;
  /**
   * `playable` controls cursor + hover lift only — visual disabled state if false.
   * Disable taps entirely with `onClick={undefined}`.
   */
  playable?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  ariaLabel?: string;
}

/**
 * Real UNO card render. Uses CSS-only 3D layering (no images): a base layer for depth,
 * a colored face with a tilted white oval and a large central glyph, plus mini-glyphs in
 * opposing corners. Wild and Wild +4 use a 4-quadrant gradient.
 *
 * Why CSS-only: keeps the bundle light, scales perfectly across screen sizes, and gets
 * the same look on every browser without depending on asset packaging.
 */
export default function UnoCard({ code, playable = false, onClick, style, ariaLabel }: UnoCardProps) {
  const m = parseUnoCard(code);
  const cardColor = m.color;
  const face = cardColor === null ? '#111' : UNO_COLOR_BG[cardColor];
  const base = cardColor === null ? '#000' : UNO_COLOR_BG_DARK[cardColor];
  const isWild = cardColor === null;
  const glyphColor = isWild ? '#111' : face;

  const cardStyle = {
    ...style,
    ['--card-face' as string]: face,
    ['--card-base' as string]: base,
    ['--card-glyph' as string]: glyphColor,
  } as CSSProperties;

  const className = [
    'uno-card',
    isWild ? 'uno-card--wild' : '',
    onClick && playable ? 'uno-card--playable' : '',
    onClick && !playable ? 'uno-card--unplayable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={className}
      style={cardStyle}
      onClick={playable ? onClick : undefined}
      aria-label={ariaLabel}
      type={onClick ? 'button' : undefined}
    >
      <div className="uno-card__base" />
      <div className="uno-card__face">
        <div className="uno-card__corner uno-card__corner--tl">{m.glyph}</div>
        <div className="uno-card__oval" />
        <div className="uno-card__glyph">{m.glyph}</div>
        <div className="uno-card__corner uno-card__corner--br">{m.glyph}</div>
      </div>
    </Tag>
  );
}
