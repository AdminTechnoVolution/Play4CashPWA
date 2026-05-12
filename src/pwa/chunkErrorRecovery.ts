/**
 * After a deploy, an old tab may try to lazy-load a JS chunk whose hash no longer exists
 * on the CDN (the new build replaced it). The browser throws `ChunkLoadError` and React
 * shows a blank screen. We detect that pattern, force a hard reload **once** so the user
 * gets the fresh `index.html` (and the new chunk hashes), and bail out with an in-place
 * notice if it keeps failing.
 *
 * `installChunkErrorRecovery()` is called once from `main.tsx`.
 */

const RELOAD_GUARD_KEY = 'p4c_chunk_reload_guard';
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_PATTERNS: RegExp[] = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

function looksLikeChunkError(message?: unknown): boolean {
  if (typeof message !== 'string') return false;
  return CHUNK_PATTERNS.some((re) => re.test(message));
}

function recentlyReloaded(): boolean {
  try {
    const ts = sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function showFatalNotice(): void {
  try {
    document.body.innerHTML = `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; text-align: center; color: #1a2332;">
        <h2 style="margin: 0 0 12px;">Actualización requerida</h2>
        <p style="line-height: 1.5; margin: 0 0 24px;">
          La versión que tienes cacheada ya no es compatible con el servidor.
          Cierra completamente la app o el navegador y vuelve a abrirla.
        </p>
        <button id="p4c-hard-reload"
          style="background: #c9a84c; color: #0a1628; border: 0; border-radius: 12px; padding: 12px 24px; font-weight: 700; cursor: pointer;">
          Reintentar
        </button>
      </div>`;
    document
      .getElementById('p4c-hard-reload')
      ?.addEventListener('click', () => window.location.reload());
  } catch {
    /* ignore */
  }
}

function handleChunkFailure(message: string): void {
  // eslint-disable-next-line no-console
  console.warn('[p4c] chunk load failure detected:', message);
  if (recentlyReloaded()) {
    showFatalNotice();
    return;
  }
  markReloaded();
  window.location.reload();
}

export function installChunkErrorRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    if (looksLikeChunkError(event.message)) {
      handleChunkFailure(event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | string | undefined;
    const message =
      typeof reason === 'string' ? reason : (reason?.message ?? '');
    if (looksLikeChunkError(message)) {
      handleChunkFailure(message);
    }
  });
}
