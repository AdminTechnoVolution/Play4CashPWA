/**
 * Web Vibration API — mirrors Android GameVibration.playTimeoutWarning pattern.
 * @see com.play4cash.play.ui.game.GameVibration
 */

/** Same longArrayOf as Android createWaveform (ms): delay, vibrate, pause, … */
const TIMEOUT_WARNING_PATTERN_MS = [
  0,
  320, 110, 320, 110, 320, 110, 320, 110,
  320, 130, 380, 130, 380, 150, 450,
] as const;

export function playTimeoutWarning(): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate([...TIMEOUT_WARNING_PATTERN_MS]);
  } catch {
    // Some browsers block vibration without gesture or in background
  }
}

const GameVibration = { playTimeoutWarning };
export default GameVibration;
