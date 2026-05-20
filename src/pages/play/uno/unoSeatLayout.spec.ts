import { describe, expect, it } from 'vitest';
import { getSeatLayout, orderPlayersForTable, UNO_SEAT_LAYOUTS } from './unoSeatLayout';

describe('unoSeatLayout', () => {
  it('rotates the local user to index 0', () => {
    expect(orderPlayersForTable(['a', 'b', 'me', 'c'], 'me')).toEqual(['me', 'c', 'a', 'b']);
  });

  it('provides exact slot counts for 2 through 10', () => {
    for (let n = 2; n <= 10; n += 1) {
      expect(getSeatLayout(n)).toHaveLength(n);
      expect(UNO_SEAT_LAYOUTS[n]).toHaveLength(n);
    }
  });

  it('places two players on opposite sides', () => {
    const [home, away] = getSeatLayout(2);
    expect(home.y).toBeGreaterThan(away.y);
  });

  it('uses ten perimeter slots for max table', () => {
    const layout = getSeatLayout(10);
    expect(layout.filter((s) => s.y < 20)).toHaveLength(3);
    expect(layout.filter((s) => s.x > 90)).toHaveLength(2);
    expect(layout.filter((s) => s.y > 80)).toHaveLength(3);
    expect(layout.filter((s) => s.x < 10)).toHaveLength(2);
  });
});
