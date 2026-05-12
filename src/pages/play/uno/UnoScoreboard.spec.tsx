import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnoScoreboard from './UnoScoreboard';

const baseProps = {
  playerOrder: ['me', 'opp1'],
  usernames: { me: 'Me', opp1: 'Alice' },
  matchScores: { me: 60, opp1: 120 },
  matchTargetScore: 200,
  myUserId: 'me',
  roundNumber: 2,
  lastRoundWinnerUsername: 'Alice',
  lastRoundScoreDealt: 35,
  countdownSec: 5,
  playersReadyForNext: [] as string[],
  onReady: vi.fn(),
  titleLabel: 'End of round',
  roundLabel: 'Round {{round}}',
  pointsLabel: 'Points',
  targetLabel: 'Target',
  readyButtonLabel: 'Ready',
  readyConfirmedLabel: 'Waiting…',
  countdownLabel: 'Next in {{seconds}}s',
  winnerOfRoundLabel: '{{username}} won (+{{score}})',
};

describe('UnoScoreboard', () => {
  it('renders all players with their cumulative scores sorted by score (desc)', () => {
    render(<UnoScoreboard {...baseProps} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Me')).toBeTruthy();
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    // Both rows show "/ 200"
    expect(screen.getAllByText('/ 200').length).toBe(2);
  });

  it('shows the round-winner banner with substituted username and score', () => {
    render(<UnoScoreboard {...baseProps} />);
    expect(screen.getByText('Alice won (+35)')).toBeTruthy();
  });

  it('substitutes the round number into the round label', () => {
    render(<UnoScoreboard {...baseProps} />);
    expect(screen.getByText('Round 2')).toBeTruthy();
  });

  it('substitutes the seconds into the countdown label', () => {
    render(<UnoScoreboard {...baseProps} countdownSec={3} />);
    expect(screen.getByText('Next in 3s')).toBeTruthy();
  });

  it('calls onReady when the ready button is tapped', () => {
    const onReady = vi.fn();
    render(<UnoScoreboard {...baseProps} onReady={onReady} />);
    const btn = screen.getByRole('button', { name: 'Ready' });
    btn.click();
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('disables the ready button and switches its label once the local player is ready', () => {
    render(<UnoScoreboard {...baseProps} playersReadyForNext={['me']} />);
    const btn = screen.getByRole('button', { name: 'Waiting…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
