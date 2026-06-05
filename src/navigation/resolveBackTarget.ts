/** Explicit SPA back targets — avoids history.back() landing on /login or full reloads. */
export function resolveBackTarget(pathname: string): string {
  if (pathname.startsWith('/withdrawal-verify')) return '/withdrawal';
  const tournamentBracket = pathname.match(/^\/tournaments\/([^/]+)\/bracket/);
  if (tournamentBracket) return `/tournaments/${tournamentBracket[1]}`;
  const tournamentDetail = pathname.match(/^\/tournaments\/([^/]+)/);
  if (tournamentDetail) return '/tournaments';
  if (pathname.startsWith('/tournaments')) return '/dashboard';
  if (pathname.startsWith('/play/')) return '/dashboard';
  if (pathname.startsWith('/rooms/')) return '/dashboard';
  return '/dashboard';
}
