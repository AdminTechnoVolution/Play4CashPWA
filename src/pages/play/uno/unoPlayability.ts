import type { UnoCardCode, UnoColor } from '../../../data/models/ApiModels';
import { parseUnoCard } from './unoCardModel';

/**
 * Client-side mirror of the server's `validatePlay`. Used ONLY for visual hints
 * (greying-out unplayable cards). The server is the source of truth — never gate
 * actions purely on this. Mirrors:
 *
 * - With a pending +2/+4 stack, only `take_draw_stack` is legal (no card plays).
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
  if (drawStackPending > 0) return false;
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
