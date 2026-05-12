import UnoCard from './UnoCard';
import UnoCardBack from './UnoCardBack';
import type { UnoCardCode, UnoColor } from '../../../data/models/ApiModels';

interface UnoTableProps {
  topDiscard: UnoCardCode | null;
  drawPileCount: number;
  currentColor: UnoColor;
  direction: 1 | -1;
  drawStackPending: number;
  canDraw: boolean;
  onDrawClick: () => void;
  drawCountLabel: string; // e.g. "Mazo (42)"
  discardCountLabel: string; // e.g. "Descarte (8)"
}

/**
 * Center of the table: the discard pile (with current-color halo and stack badge),
 * a rotating direction indicator, and the draw pile (tappable when legal).
 */
export default function UnoTable({
  topDiscard,
  drawPileCount,
  currentColor,
  direction,
  drawStackPending,
  canDraw,
  onDrawClick,
  drawCountLabel,
  discardCountLabel,
}: UnoTableProps) {
  return (
    <div className="uno-piles">
      <div className={`uno-pile uno-pile--discard uno-color-${currentColor}`}>
        <span className={`uno-direction ${direction === -1 ? 'uno-direction--reverse' : ''}`}>↻</span>
        <div className="uno-pile__shadow" />
        <div className="uno-pile__stack">
          {topDiscard && <UnoCardBack />}
          {topDiscard && <UnoCardBack />}
          {topDiscard && <UnoCard code={topDiscard} ariaLabel={topDiscard} />}
        </div>
        {drawStackPending > 0 && <div className="uno-stack-badge">+{drawStackPending}</div>}
        <div className="uno-pile__count">{discardCountLabel}</div>
      </div>

      <div className="uno-pile">
        <div className="uno-pile__shadow" />
        <div className="uno-pile__stack">
          <UnoCardBack />
          <UnoCardBack />
          <button
            type="button"
            onClick={canDraw ? onDrawClick : undefined}
            disabled={!canDraw}
            style={{
              all: 'unset',
              display: 'block',
              cursor: canDraw ? 'pointer' : 'default',
              filter: canDraw ? 'none' : 'brightness(0.7)',
            }}
            aria-label="draw"
          >
            <UnoCardBack />
          </button>
        </div>
        <div className="uno-pile__count">
          {drawCountLabel} ({drawPileCount})
        </div>
      </div>
    </div>
  );
}
