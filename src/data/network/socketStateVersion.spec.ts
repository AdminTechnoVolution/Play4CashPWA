import { describe, expect, it, vi } from 'vitest';
import {
  applyIncomingStateVersion,
  createStateVersionTracker,
  resetStateVersionTracker,
} from './socketStateVersion';

describe('socketStateVersion', () => {
  it('tracks monotonic versions', () => {
    const onGap = vi.fn();
    const tracker = createStateVersionTracker(onGap);
    expect(applyIncomingStateVersion(tracker, { stateVersion: 1 })).toBe(true);
    expect(applyIncomingStateVersion(tracker, { stateVersion: 2 })).toBe(true);
    expect(onGap).not.toHaveBeenCalled();
  });

  it('detects gap and triggers resync', () => {
    const onGap = vi.fn();
    const tracker = createStateVersionTracker(onGap);
    applyIncomingStateVersion(tracker, { stateVersion: 1 });
    applyIncomingStateVersion(tracker, { stateVersion: 5 });
    expect(onGap).toHaveBeenCalledTimes(1);
  });

  it('ignores older snapshots without replacing current state', () => {
    const tracker = createStateVersionTracker(vi.fn());
    applyIncomingStateVersion(tracker, { stateVersion: 10 });
    expect(applyIncomingStateVersion(tracker, { stateVersion: 9 })).toBe(false);
    expect(tracker.lastVersion).toBe(10);
  });

  it('resets tracker', () => {
    const tracker = createStateVersionTracker(vi.fn());
    applyIncomingStateVersion(tracker, { stateVersion: 10 });
    resetStateVersionTracker(tracker);
    expect(tracker.lastVersion).toBe(0);
  });
});
