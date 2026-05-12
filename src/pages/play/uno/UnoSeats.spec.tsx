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
  it('renders only opponents (excluding self) with their hand counts', () => {
    render(<UnoSeats {...baseProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText('Me')).toBeNull();
    expect(screen.getByText('×1')).toBeTruthy();
    expect(screen.getByText('×4')).toBeTruthy();
  });

  it('shows the UNO badge for any opponent in unoCalled', () => {
    render(<UnoSeats {...baseProps} unoCalled={['opp1']} />);
    expect(screen.getByText('UNO')).toBeTruthy();
  });

  it('shows the catch button only when an opponent is the pending offender', () => {
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

  it('does not expose a catch button on the player themselves (always rendered as opponent only)', () => {
    // Self is filtered before render — even setting pendingUnoOffender to 'me' must not paint a button.
    render(<UnoSeats {...baseProps} pendingUnoOffender="me" />);
    expect(screen.queryByRole('button', { name: 'CATCH' })).toBeNull();
  });
});
