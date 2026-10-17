import type { Page } from '@playwright/test';

/** Test-only browser responses, never imported by production code. No external requests or funds. */
export async function installBrowserApi(page: Page, email: string): Promise<void> {
  const account = { _id: '507f1f77bcf86cd799439011', email, username: 'Browser Test', balance: '100.000000' };
  const gameId = '507f1f77bcf86cd799439012';
  const games = [{ _id: gameId, name: 'Connect Four', socket_code: 'connect-four', min_bet: 1,
    default_bets: [1, 5, 10], description: 'Browser fixture game', min_players: 2, max_players: 2 }];
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: account._id, typ: 'access', exp: 4102444800 })).toString('base64url')}.browser-fixture`;
  await page.addInitScript(() => localStorage.setItem('p4c_language', 'en'));
  await page.route('**/socket.io/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, messages: [], data }) });
    if (pathname === '/api/login/refresh') return reply({ token });
    if (['/api/logout', '/api/login/invalidate-browser-session', '/api/user/push-subscription'].includes(pathname)) return reply({});
    if (pathname === '/api/user/account') return reply(account);
    if (pathname === '/api/user/public/stats') return reply({ registeredUsers: 42 });
    if (pathname === '/api/games') return reply(games);
    if (pathname === '/api/rooms/stats') return reply({ playersOnline: 2, activeGames: 0, totalBetAmount: 0 });
    if (pathname === '/api/rooms/active') return reply(null);
    if (pathname.startsWith('/api/rooms/game/')) return reply([]);
    if (['/api/tournaments', '/api/tournaments/mine', '/api/tournaments/history', '/api/greetings', '/api/contact-us/mine', '/api/payments/orders',
      '/api/transactions/recharge/history', '/api/transactions/withdrawal/history', '/api/user/history'].includes(pathname)) return reply([]);
    if (pathname === '/api/contact-us' && request.method() === 'POST') return reply({ _id: 'browser-contact-fixture' });
    if (pathname === '/api/payments/balance') return reply({ available: '100.000000', reserved: '0.000000' });
    if (pathname === '/api/payments/limits') return reply({ depositLimit24h: '1000.000000' });
    if (pathname === '/api/payments/networks') return reply([{ network: 'TRC20', currency: 'usdttrc20', asset: 'USDT' }]);
    if (pathname === '/api/payments/deposits' && request.method() === 'POST') return reply({ id: '507f1f77bcf86cd799439013', kind: 'deposit', network: 'TRC20', amount: '10.000000', payAmount: '10.000000', address: 'BROWSER_FIXTURE_NOT_A_REAL_WALLET', status: 'waiting', createdAt: new Date().toISOString() });
    return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ message: `Browser fixture missing: ${request.method()} ${pathname}` }) });
  });
}
