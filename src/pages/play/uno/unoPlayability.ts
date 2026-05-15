import type { UnoCardCode, UnoColor } from '../../../data/models/ApiModels';
import { parseUnoCard } from './unoCardModel';

/**
 * Client-side mirror of the server's `validatePlay`. Used ONLY for visual hints
 * (greying-out unplayable cards). The server is the source of truth — never gate
 * actions purely on this.
 *
 * - With a pending draw stack: colored +2 only if discard top is a colored +2; Wild +4
 *   stacks on +2 or +4 (or take_stack).
 * - W4 is illegal if the player has any card matching the current color.
 * - Otherwise: matches by color, by number/symbol, or any wild.
 */
export function isCardPlayableClient(
  card: UnoCardCode,
  topDiscard: UnoCardCode | null,
  currentColor: UnoColor,
  hand: UnoCardCode[],
  drawStackPending: number,
): boolean {
  if (drawStackPending > 0) {
    const m = parseUnoCard(card);
    if (m.kind !== 'draw2' && m.kind !== 'wild4') return false;
    if (m.kind === 'draw2') {
      if (!topDiscard) return false;
      return parseUnoCard(topDiscard).kind === 'draw2';
    }
    return !hand.some((c) => {
      const cm = parseUnoCard(c);
      return cm.color === currentColor;
    });
  }
  if (!topDiscard) return true;

  const m = parseUnoCard(card);
  if (m.kind === 'wild') return true;
  if (m.kind === 'wild4') {
    return !hand.some((c) => {
      const cm = parseUnoCard(c);
      return cm.color === currentColor;
    });
  }

  const top = parseUnoCard(topDiscard);
  if (m.color === currentColor) return true;
  if (top.color && m.color === top.color) return true;
  if (top.kind === m.kind && m.kind !== 'number') return true;
  if (top.kind === 'number' && m.kind === 'number' && top.glyph === m.glyph) return true;
  return false;
}
