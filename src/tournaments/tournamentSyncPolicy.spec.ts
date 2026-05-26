import { describe, expect, it } from 'vitest';
import {
  needsTournamentSocketConnection,
  pickSocketTournament,
  planTournamentSyncTick,
} from './tournamentSyncPolicy';
import type { TournamentSummary } from '../data/models/ApiModels';

function t(overrides: Partial<TournamentSummary> & Pick<TournamentSummary, 'id' | 'status'>): TournamentSummary {
  return {
    title: 'T',
    description: '',
    gameSocketCode: 'chess',
    buyIn: 0,
    maxPlayers: 10,
    registeredCount: 1,
    startsAt: new Date(Date.now() + 60_000).toISOString(),
    serverNow: new Date().toISOString(),
    remainingMs: 60_000,
    pauseRemainingMs: null,
    turnTimerSeconds: 30,
    grossPrizePool: 0,
    myRegistration: { status: 'registered' },
    myActiveMatch: null,
    ...overrides,
  };
}

const baseInput = {
  visible: true,
  focus: { kind: 'background' as const },
  catalogList: [] as TournamentSummary[],
  lastPlacementCheckAt: Date.now(),
  lobbySocketConnected: false,
  socketTournamentId: null as string | null,
};

describe('needsTournamentSocketConnection', () => {
  it('connects before live for open/full/countdown registrations', () => {
    expect(needsTournamentSocketConnection(t({ id: 'a', status: 'open' }))).toBe(true);
    expect(needsTournamentSocketConnection(t({ id: 'a', status: 'full' }))).toBe(true);
    expect(needsTournamentSocketConnection(t({ id: 'a', status: 'countdown' }))).toBe(true);
  });

  it('connects during live tournaments', () => {
    expect(needsTournamentSocketConnection(t({ id: 'a', status: 'running' }))).toBe(true);
  });
});

describe('pickSocketTournament', () => {
  it('prefers focused tournament when registered', () => {
    const a = t({ id: 'a', status: 'open' });
    const b = t({ id: 'b', status: 'running' });
    const picked = pickSocketTournament({ kind: 'bracket', tournamentId: 'a' }, [a, b], []);
    expect(picked?.id).toBe('a');
  });
});

describe('planTournamentSyncTick', () => {
  it('uses idle interval for logged-in user without registrations', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [],
    });
    expect(plan.delayMs).toBe(120_000);
    expect(plan.primaryDetailId).toBeNull();
  });

  it('uses registered interval when user has upcoming tournament', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [t({ id: 'a', status: 'open' })],
    });
    expect(plan.delayMs).toBe(60_000);
  });

  it('hydrates primary live tournament in background without socket', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [t({ id: 'live', status: 'running' })],
    });
    expect(plan.delayMs).toBe(30_000);
    expect(plan.primaryDetailId).toBe('live');
    expect(plan.primaryBracketId).toBe('live');
  });

  it('skips live HTTP hydration when socket covers primary', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [t({ id: 'live', status: 'running' })],
      lobbySocketConnected: true,
      socketTournamentId: 'live',
    });
    expect(plan.delayMs).toBe(90_000);
    expect(plan.hydratePrimaryLive).toBe(false);
    expect(plan.primaryDetailId).toBeNull();
    expect(plan.primaryBracketId).toBeNull();
  });

  it('uses focus interval on detail/bracket screens without socket', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [],
      focus: { kind: 'bracket', tournamentId: 'x' },
    });
    expect(plan.delayMs).toBe(12_000);
    expect(plan.focusBracketId).toBe('x');
    expect(plan.focusDetailId).toBe('x');
  });

  it('skips focus HTTP when socket covers focused tournament', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      myList: [t({ id: 'x', status: 'running' })],
      focus: { kind: 'bracket', tournamentId: 'x' },
      lobbySocketConnected: true,
      socketTournamentId: 'x',
    });
    expect(plan.delayMs).toBe(60_000);
    expect(plan.focusBracketId).toBeNull();
    expect(plan.focusDetailId).toBeNull();
  });

  it('slows down when tab is hidden', () => {
    const plan = planTournamentSyncTick({
      ...baseInput,
      visible: false,
      myList: [t({ id: 'a', status: 'open' })],
    });
    expect(plan.delayMs).toBe(240_000);
  });
});
