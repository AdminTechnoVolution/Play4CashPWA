/** Match ended — ignore stale lobby / waitingForOpponent socket payloads. */
export function isMatchTerminalPhase(phase: string): boolean {
  const u = String(phase).toUpperCase();
  return u === 'GAME_OVER' || u === 'FINISHED';
}

/** Whether a waiting-for-opponent lobby transition is allowed from the current state. */
export function canAcceptWaitingLobby(phase: string, gameOver?: unknown): boolean {
  if (isMatchTerminalPhase(phase)) return false;
  if (gameOver) return false;
  const normalized = String(phase).toUpperCase();
  return normalized === 'WAITING' || normalized === 'PLACEMENT';
}
