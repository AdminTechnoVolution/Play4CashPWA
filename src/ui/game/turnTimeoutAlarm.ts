/**
 * When the countdown enters the last 20% of the turn cap, play sound + vibration once.
 * Only for the local player's turn (not spectators).
 * @see com.play4cash.play.ui.game.TurnTimeoutAlarm
 */

import GameSound from './GameSound';
import GameVibration from './GameVibration';

const FRACTION = 0.2;

export function thresholdSeconds(turnCap: number): number {
  if (turnCap <= 0) return 0;
  return Math.max(1, Math.ceil(turnCap * FRACTION));
}

export function triggerTimeoutWarning(): void {
  GameSound.turnTimeoutWarning();
  GameVibration.playTimeoutWarning();
}
