import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnoSeats from './UnoSeats';

const baseProps = {
  playerOrder: ['me', 'opp1', 'opp2'],
  myUserId: 'me',
  usernames: { me: 'Me', opp1: 'Alice', opp2: 'Bob' },
  handCount: { me: 5, opp1: 1, opp2: 4 },
  eliminatedPlayers: [] as string[],
  unoCalled: [] as string[],
  pendingUnoOffender: null as string | null,
  currentTurnPlayerId: 'opp1',
  onChallenge: vi.fn(),
  challengeLabel: 'CATCH',
  unoLabel: 'UNO',
};

describe('UnoSeats', () => {
  it('renders every player including self with hand counts', () => {
    render(<UnoSeats {...baseProps} />);
    expect(screen.getByText('Me')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('×5')).toBeTruthy();
    expect(screen.getByText('×1')).toBeTruthy();
    expect(screen.getByText('×4')).toBeTruthy();
  });

  it('renders every available identity and never falls back to a technical id', () => {
    render(
      <UnoSeats
        {...baseProps}
        playerOrder={['me', 'opp1', 'opp2', 'player-id-4']}
        usernames={{ me: 'Me', opp1: 'Alice', opp2: 'Bob' }}
        handCount={{ me: 5, opp1: 4, opp2: 3, 'player-id-4': 2 }}
      />,
    );
    expect(screen.getByText('Me')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('player-id-4')).toBeNull();
    expect(screen.getByText(/opponent|oponente/i)).toBeTruthy();
  });

  it('marks the local player seat', () => {
    const { container } = render(<UnoSeats {...baseProps} />);
    expect(container.querySelector('.uno-seat--self')).toBeTruthy();
  });

  it('positions seats around the table ring', () => {
    const { container } = render(<UnoSeats {...baseProps} />);
    const seat = container.querySelector('.uno-seat') as HTMLElement;
    expect(seat.style.left).toBeTruthy();
    expect(seat.style.top).toBeTruthy();
  });

  it('shows the UNO badge for any player in unoCalled', () => {
    render(<UnoSeats {...baseProps} unoCalled={['opp1']} />);
    expect(screen.getByText('UNO')).toBeTruthy();
  });

  it('shows the catch button only on an opponent offender seat', () => {
    const onChallenge = vi.fn();
    render(<UnoSeats {...baseProps} pendingUnoOffender="opp1" onChallenge={onChallenge} />);
    const catchBtn = screen.getByRole('button', { name: 'CATCH' });
    catchBtn.click();
    expect(onChallenge).toHaveBeenCalledWith('opp1');
  });

  it('hides the catch button when no offender is pending', () => {
    render(<UnoSeats {...baseProps} pendingUnoOffender={null} />);
    expect(screen.queryByRole('button', { name: 'CATCH' })).toBeNull();
  });

  it('does not show catch on the local player seat even if they are the offender', () => {
    render(<UnoSeats {...baseProps} pendingUnoOffender="me" />);
    expect(screen.queryByRole('button', { name: 'CATCH' })).toBeNull();
  });
});
