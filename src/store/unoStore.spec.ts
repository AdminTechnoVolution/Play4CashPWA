import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnoStore, UnoPhase } from './unoStore';

vi.mock('../data/network/UnoSocketManager', () => {
  return {
    UnoSocketManager: vi.fn().mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      requestSync: vi.fn(),
      playCard: vi.fn(),
      drawCard: vi.fn(),
      passTurn: vi.fn(),
      takeDrawStack: vi.fn(),
      callUno: vi.fn(),
      challengeUnoMiss: vi.fn(),
      startNextRound: vi.fn(),
    })),
  };
});

/**
 * The store handles inbound `uno` payloads via an internal `handleUnoPayload`. We invoke
 * it indirectly by calling `connect()` then injecting payloads through the socket
 * constructor's `onMessage` callback. To keep this test focused on transition rules and
 * avoid wiring the full socket, we cheat by setting state directly via `setState`.
 */
function reset() {
  useUnoStore.setState((s) => ({
    ...s,
    phase: UnoPhase.PLAY,
    matchScores: {},
    roundNumber: 1,
    matchTargetScore: 200,
    matchWinnerId: null,
    nextRoundStartsAt: null,
    nextRoundCountdownSec: 0,
    playersReadyForNext: [],
    roundHistory: [],
    lastRoundWinnerId: null,
    lastRoundWinnerUsername: null,
    lastRoundScoreDealt: 0,
    matchPrize: 0,
  }));
}

describe('useUnoStore — multi-round transitions (Phase 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a startNextRound action that is a no-op outside BETWEEN_ROUNDS', () => {
    const action = useUnoStore.getState().startNextRound;
    expect(typeof action).toBe('function');
    // Phase = PLAY → noop, must not throw
    action();
    expect(useUnoStore.getState().phase).toBe(UnoPhase.PLAY);
  });

  it('seeds default scoring fields with correct types', () => {
    const s = useUnoStore.getState();
    expect(s.matchScores).toEqual({});
    expect(s.roundNumber).toBe(1);
    expect(s.matchTargetScore).toBe(200);
    expect(s.matchWinnerId).toBeNull();
    expect(s.playersReadyForNext).toEqual([]);
  });

  it('startNextRound is also a no-op when the local player is already in playersReadyForNext', () => {
    useUnoStore.setState({
      phase: UnoPhase.BETWEEN_ROUNDS,
      myUserId: 'me',
      playersReadyForNext: ['me'],
      isSpectator: false,
    } as Partial<ReturnType<typeof useUnoStore.getState>> as never);
    // Force a no-op by stubbing the socket
    const stub = { startNextRound: vi.fn() };
    useUnoStore.setState({ socket: stub as unknown as ReturnType<typeof useUnoStore.getState>['socket'] });
    useUnoStore.getState().startNextRound();
    expect(stub.startNextRound).not.toHaveBeenCalled();
  });

  it('startNextRound emits when phase is BETWEEN_ROUNDS and the player is not yet ready', () => {
    const stub = { startNextRound: vi.fn() };
    useUnoStore.setState({
      phase: UnoPhase.BETWEEN_ROUNDS,
      myUserId: 'me',
      playersReadyForNext: [],
      isSpectator: false,
      roomId: 'room-x',
      socket: stub as unknown as ReturnType<typeof useUnoStore.getState>['socket'],
    } as never);
    useUnoStore.getState().startNextRound();
    expect(stub.startNextRound).toHaveBeenCalledWith('room-x');
  });

  it('advances to PLAY when roundStarted is set even if roundEnded is still true (stale merge)', () => {
    useUnoStore.setState({
      phase: UnoPhase.BETWEEN_ROUNDS,
      roomId: 'room-x',
      myUserId: 'u1',
      hand: [],
      isSpectator: false,
      socket: { requestSync: vi.fn() } as unknown as ReturnType<typeof useUnoStore.getState>['socket'],
    });
    useUnoStore.getState().handleUnoPayload({
      success: true,
      data: {
        roundEnded: true,
        roundStarted: true,
        betweenRounds: false,
        gameStarted: true,
        hand: ['R1', 'R2'],
        yourTurn: true,
        roundNumber: 2,
        playerOrder: ['u1', 'u2'],
        handCount: { u1: 2, u2: 7 },
        usernames: { u1: 'a', u2: 'b' },
        matchScores: { u1: 10, u2: 0 },
        matchTargetScore: 200,
        matchWinnerId: null,
        roundHistory: [{ round: 1, winnerId: 'u1', scoreDealt: 35, endedAt: null }],
        playersReadyForNext: [],
        currentTurnPlayerId: 'u1',
        currentTurnUsername: 'a',
        turnTimerSeconds: 45,
        drawStackPending: 0,
        eliminatedPlayers: [],
        unoCalled: [],
        pendingUnoOffender: null,
        topDiscard: 'R5',
        drawPileCount: 40,
        currentColor: 'R',
        direction: 1,
        currentPlayerIndex: 0,
        discardCount: 1,
        waitingForOpponent: false,
        isSpectator: false,
      },
      messages: ['next'],
    });
    expect(useUnoStore.getState().phase).toBe(UnoPhase.PLAY);
    expect(useUnoStore.getState().hand.length).toBe(2);
  });
});
