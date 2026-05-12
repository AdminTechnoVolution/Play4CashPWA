import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const RELOAD_GUARD_KEY = 'p4c_chunk_reload_guard';

describe('chunkErrorRecovery', () => {
  let originalLocation: Location;
  let reloadMock: ReturnType<typeof vi.fn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    originalLocation = window.location;
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    consoleSpy.mockRestore();
  });

  it('reloads on first ChunkLoadError and writes guard', async () => {
    const { installChunkErrorRecovery } = await import('./chunkErrorRecovery');
    installChunkErrorRecovery();

    window.dispatchEvent(new ErrorEvent('error', { message: 'ChunkLoadError: x' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).not.toBeNull();
  });

  it('does NOT reload on a second ChunkLoadError within the guard window', async () => {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    const { installChunkErrorRecovery } = await import('./chunkErrorRecovery');
    installChunkErrorRecovery();

    window.dispatchEvent(new ErrorEvent('error', { message: 'Loading chunk 7 failed' }));

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('ignores unrelated errors', async () => {
    const { installChunkErrorRecovery } = await import('./chunkErrorRecovery');
    installChunkErrorRecovery();

    window.dispatchEvent(new ErrorEvent('error', { message: 'Some random TypeError' }));

    expect(reloadMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
  });
});
