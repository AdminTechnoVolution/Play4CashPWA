import { beforeEach, describe, expect, it } from 'vitest';
import { DominoPhase, useDominoStore } from './dominoStore';

describe('useDominoStore start ordering', () => {
  beforeEach(() => {
    useDominoStore.setState({
      phase: DominoPhase.PLAY,
      gameOver: null,
      statusMessage: 'domino_your_turn',
      roomId: 'room-1',
      isSpectator: false,
    });
  });

  it('does not return from PLAY to WAITING on a late lobby packet', () => {
    useDominoStore.getState().handleDominoPayload({
      success: true,
      data: {
        waitingForOpponent: true,
        playersJoined: 3,
        maxPlayers: 3,
      },
      messages: ['ws.games.waitingOpponent'],
    });

    expect(useDominoStore.getState().phase).toBe(DominoPhase.PLAY);
  });

  it('shows and preserves every real identity in a four-player game', () => {
    useDominoStore.setState({
      myUserId: 'me',
      initialOpponentName: '',
      opponents: [],
    });
    useDominoStore.getState().handleDominoPayload({
      success: true,
      data: {
        gameStarted: true,
        waitingForOpponent: false,
        hand: [[0, 0]],
        board: [],
        handCount: { me: 1, p2: 5, p3: 4, p4: 3 },
        playerOrder: ['me', 'p2', 'p3', 'p4'],
        usernames: { me: 'Current', p2: 'Ana', p3: 'Luis', p4: 'Marta' },
      },
    });

    expect(useDominoStore.getState().opponents).toEqual([
      { username: 'Ana', tileCount: 5 },
      { username: 'Luis', tileCount: 4 },
      { username: 'Marta', tileCount: 3 },
    ]);

    useDominoStore.getState().handleDominoPayload({
      success: true,
      data: {
        handCount: { me: 1, p2: 4, p3: 4, p4: 3 },
        yourTurn: false,
      },
    });
    expect(useDominoStore.getState().opponents).toEqual([
      { username: 'Ana', tileCount: 4 },
      { username: 'Luis', tileCount: 4 },
      { username: 'Marta', tileCount: 3 },
    ]);
  });

  it('uses human labels and never participant ids when names are absent', () => {
    useDominoStore.setState({
      myUserId: 'me',
      initialOpponentName: '',
      opponents: [],
    });
    useDominoStore.getState().handleDominoPayload({
      success: true,
      data: {
        gameStarted: true,
        hand: [[0, 0]],
        board: [],
        handCount: { me: 1, 'player-id-2': 5, 'player-id-3': 4 },
        playerOrder: ['me', 'player-id-2', 'player-id-3'],
        usernames: {},
      },
    });

    const labels = useDominoStore.getState().opponents.map((op) => op.username);
    expect(labels).toHaveLength(2);
    expect(labels.join(' ')).not.toContain('player-id');
    expect(labels.every((label) => /opponent|oponente/i.test(label))).toBe(true);
  });
});
