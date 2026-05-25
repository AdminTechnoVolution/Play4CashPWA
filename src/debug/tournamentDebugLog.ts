/** Debug session 83380c — tournament join diagnostics. Remove after verification. */
export function tournamentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const entry = {
    sessionId: '83380c',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  };
  try {
    const key = 'p4c_debug_83380c';
    const prev = JSON.parse(sessionStorage.getItem(key) || '[]') as unknown[];
    prev.push(entry);
    sessionStorage.setItem(key, JSON.stringify(prev.slice(-80)));
  } catch {
    /* ignore */
  }
  // #region agent log
  fetch('http://127.0.0.1:7561/ingest/0b3eb4fe-aeac-4231-b94b-1592d63bdad8', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '83380c' },
    body: JSON.stringify(entry),
  }).catch(() => {});
  // #endregion
}
