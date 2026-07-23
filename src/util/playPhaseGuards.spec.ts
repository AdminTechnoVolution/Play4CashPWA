import { describe, expect, it } from 'vitest';
import { canAcceptWaitingLobby, isMatchTerminalPhase } from './playPhaseGuards';

describe('playPhaseGuards', () => {
  it('isMatchTerminalPhase detects terminal phases', () => {
    expect(isMatchTerminalPhase('GAME_OVER')).toBe(true);
    expect(isMatchTerminalPhase('finished')).toBe(true);
    expect(isMatchTerminalPhase('WAITING')).toBe(false);
    expect(isMatchTerminalPhase('PLAY')).toBe(false);
  });

  it('canAcceptWaitingLobby blocks after game over', () => {
    expect(canAcceptWaitingLobby('GAME_OVER')).toBe(false);
    expect(canAcceptWaitingLobby('PLAY', { outcome: 'win' })).toBe(false);
    expect(canAcceptWaitingLobby('WAITING')).toBe(true);
    expect(canAcceptWaitingLobby('PLAY')).toBe(false);
    expect(canAcceptWaitingLobby('placement')).toBe(true);
  });
});
