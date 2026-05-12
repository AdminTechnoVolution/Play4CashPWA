/**
 * Compares semver-like strings (major.minor.patch with optional `+build` suffix).
 * Returns negative if `a < b`, 0 if equal, positive if `a > b`. Build suffixes are ignored.
 * Non-numeric segments default to 0 so we never throw on unexpected values.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (s: string): number[] =>
    String(s).split('+')[0].split('.').map((p) => {
      const n = parseInt(p, 10);
      return Number.isFinite(n) ? n : 0;
    });
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

let lastForcedVersion: string | null = null;

/**
 * Called from the response interceptor on every API response. If the API ships
 * `X-App-Min-Version` greater than the running build, fires `p4c:force-update` once
 * (until the required version changes again) so the modal can switch to "forced" mode.
 */
export function checkAppMinVersion(headerValue: string | null | undefined): void {
  if (!headerValue) return;
  const required = String(headerValue).trim();
  if (!required) return;

  if (compareSemver(__APP_VERSION__, required) >= 0) return;

  if (lastForcedVersion === required) return;
  lastForcedVersion = required;

  window.dispatchEvent(
    new CustomEvent('p4c:force-update', { detail: { requiredVersion: required } }),
  );
}
