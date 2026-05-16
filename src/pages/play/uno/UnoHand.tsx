import type { CSSProperties } from 'react';
import UnoCard from './UnoCard';
import type { UnoCardCode, UnoColor } from '../../../data/models/ApiModels';
import { isCardPlayableClient } from './unoPlayability';

interface UnoHandProps {
  hand: UnoCardCode[];
  topDiscard: UnoCardCode | null;
  currentColor: UnoColor;
  drawStackPending: number;
  isMyTurn: boolean;
  onCardPlay: (cardIndex: number) => void;
}

/**
 * Player hand as a horizontal fan. When many cards overflow the viewport width, only
 * `.uno-hand` scrolls horizontally (not the full page — `.uno-page` keeps overflow hidden).
 */
export default function UnoHand({ hand, topDiscard, currentColor, drawStackPending, isMyTurn, onCardPlay }: UnoHandProps) {
  const n = hand.length;
  const center = (n - 1) / 2;
  return (
    <div className="uno-hand">
      {/* Scroll viewport: only this strip scrolls horizontally when the fan is wider than the screen. */}
      <div className="uno-hand__scroll">
        <div className="uno-hand__inner">
          {hand.map((code, idx) => {
            const offset = idx - center;
            // Mild fan: each card rotates a bit and lifts toward the centre. Negligible past 7 cards
            // since the overlap takes over.
            const rot = offset * 4;
            const lift = -Math.abs(offset) * 1.5;
            const playable = isMyTurn && isCardPlayableClient(code, topDiscard, currentColor, hand, drawStackPending);
            const slotStyle: CSSProperties = {
              transform: `rotate(${rot}deg) translateY(${lift}px)`,
            };
            return (
              <div className="uno-hand__slot" style={slotStyle} key={`${code}-${idx}`}>
                <UnoCard
                  code={code}
                  playable={playable}
                  onClick={isMyTurn ? () => onCardPlay(idx) : undefined}
                  ariaLabel={code}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
