import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DominoTableSeats, { type DominoSeatPlayer } from './DominoTableSeats';

function players(count: number): DominoSeatPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? 'Me' : `Player ${index + 1}`,
    tileCount: 7 - Math.min(index, 5),
    isSelf: index === 0,
    isCurrentTurn: index === 2,
  }));
}

describe('DominoTableSeats', () => {
  it.each([2, 3, 4])(
    'renders unique perimeter seats for %i participants',
    (count) => {
      const { container } = render(
        <DominoTableSeats players={players(count)}>
          <div>BOARD</div>
        </DominoTableSeats>,
      );
      const seats = [...container.querySelectorAll<HTMLElement>('.domino-table-seat')];
      const board = container.querySelector('[data-region="domino-board"]');
      const perimeter = container.querySelector('[data-region="player-perimeter"]');
      expect(seats).toHaveLength(count);
      expect(new Set(seats.map((seat) => `${seat.style.left}:${seat.style.top}`)).size).toBe(count);
      expect(board).toBeTruthy();
      expect(perimeter).toBeTruthy();
      expect(board?.contains(perimeter)).toBe(false);
      expect(board?.querySelector('.domino-table-seat')).toBeNull();
      expect(screen.getByText('BOARD')).toBeTruthy();
    },
  );

  it('distinguishes self and current-turn seats without exposing identifiers', () => {
    const { container } = render(
      <DominoTableSeats players={players(4)}>
        <div>BOARD</div>
      </DominoTableSeats>,
    );
    expect(container.querySelectorAll('.domino-table-seat--self')).toHaveLength(1);
    expect(container.querySelectorAll('.domino-table-seat--current')).toHaveLength(1);
    expect(container.querySelector('[aria-current="true"]')).toBeTruthy();
    expect(container.querySelectorAll('.domino-table-seat__turn')).toHaveLength(1);
    expect(container.querySelector('.domino-table-seat__avatar')).toBeNull();
    expect(container.querySelector('.domino-table-seat__mini-tile')).toBeNull();
    expect(screen.getByText('Player 4')).toBeTruthy();
  });
});
