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
 * The player's own hand laid out in a centered horizontal fan with overlapping cards.
 * Each card slot computes its own slight rotation/translation so the row reads as a 3D
 * arc. Cards greyed out when not legal (per the client-side `isCardPlayableClient`).
 */
export default function UnoHand({ hand, topDiscard, currentColor, drawStackPending, isMyTurn, onCardPlay }: UnoHandProps) {
  const n = hand.length;
  const center = (n - 1) / 2;
  return (
    <div className="uno-hand">
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
  );
}
