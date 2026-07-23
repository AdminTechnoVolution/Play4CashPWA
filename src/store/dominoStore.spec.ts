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
});
