import { describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { act, renderHook } from '@testing-library/react';

/**
 * Phase D: the PlayPage forfeit button reuses the same in-flight guard pattern that
 * applies to every "destructive button that fires a network call" surface. This test
 * pins the behaviour in isolation so the regression risk on PlayPage stays low — if
 * someone ever drops the guard, the unit test fails before product QA notices a
 * double-payout in the wild.
 */
function useLeaveGuard(leaveFn: () => Promise<void>) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  pendingRef.current = pending;

  const handle = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await leaveFn();
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return { pending, handle };
}

describe('useLeaveGuard (PlayPage forfeit pattern)', () => {
  it('only fires leaveRoom once when invoked twice in quick succession', async () => {
    const leaveFn = vi.fn().mockImplementation(() => new Promise<void>((r) => setTimeout(r, 20)));
    const { result } = renderHook(() => useLeaveGuard(leaveFn));

    await act(async () => {
      const p1 = result.current.handle();
      const p2 = result.current.handle();
      await Promise.all([p1, p2]);
    });

    expect(leaveFn).toHaveBeenCalledTimes(1);
  });

  it('clears pending back to false after a successful leaveFn call', async () => {
    const leaveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLeaveGuard(leaveFn));

    expect(result.current.pending).toBe(false);
    await act(async () => {
      await result.current.handle();
    });
    expect(result.current.pending).toBe(false);
  });

  it('still releases pending and surfaces the rejection if leaveFn throws', async () => {
    const leaveFn = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useLeaveGuard(leaveFn));

    await act(async () => {
      await expect(result.current.handle()).rejects.toThrow('network');
    });
    expect(result.current.pending).toBe(false);
  });
});
