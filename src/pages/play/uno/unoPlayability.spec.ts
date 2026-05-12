import { describe, expect, it } from 'vitest';
import { isCardPlayableClient } from './unoPlayability';

describe('isCardPlayableClient', () => {
  it('blocks every card when a draw stack is pending', () => {
    expect(isCardPlayableClient('R5', 'R7', 'R', ['R5', 'W4'], 2)).toBe(false);
    expect(isCardPlayableClient('W4', 'R7', 'R', ['W4'], 2)).toBe(false);
  });

  it('allows match by current color', () => {
    expect(isCardPlayableClient('R5', 'B7', 'R', ['R5'], 0)).toBe(true);
  });

  it('allows match by number', () => {
    expect(isCardPlayableClient('B7', 'R7', 'R', ['B7'], 0)).toBe(true);
  });

  it('allows match by symbol kind for action cards (e.g. Skip on Skip)', () => {
    expect(isCardPlayableClient('GSkip', 'RSkip', 'R', ['GSkip'], 0)).toBe(true);
    expect(isCardPlayableClient('GReverse', 'YReverse', 'Y', ['GReverse'], 0)).toBe(true);
  });

  it('always allows plain Wild', () => {
    expect(isCardPlayableClient('W', 'R7', 'R', ['W'], 0)).toBe(true);
    expect(isCardPlayableClient('W', 'R7', 'R', ['W', 'B3'], 0)).toBe(true);
  });

  it('blocks W4 when the player has any card matching the current color', () => {
    expect(isCardPlayableClient('W4', 'B7', 'B', ['W4', 'B3'], 0)).toBe(false);
  });

  it('allows W4 when the player has no card of the current color', () => {
    expect(isCardPlayableClient('W4', 'B7', 'B', ['W4', 'R3', 'GSkip'], 0)).toBe(true);
  });

  it('rejects mismatch on color and rank', () => {
    expect(isCardPlayableClient('B5', 'R7', 'R', ['B5'], 0)).toBe(false);
  });
});
