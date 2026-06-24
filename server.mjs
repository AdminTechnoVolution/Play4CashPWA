import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRuntimeConfig } from './scripts/generate-runtime-config.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || process.env.WEBSITES_PORT || 8080);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const PWA_API_PROXY_TARGET =
  process.env.PWA_API_PROXY_TARGET?.trim() ||
  process.env.VITE_API_URL?.trim() ||
  '';
const GOOGLE_ORIGINS = [
  'https://accounts.google.com',
  'https://apis.google.com',
  'https://oauth2.googleapis.com',
  'https://www.gstatic.com',
  'https://lh3.googleusercontent.com',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function parseAbsoluteOrigin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseTargetUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHiddenPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.some((part) => part.startsWith('.') && part !== '.well-known');
}

function isHashedAsset(pathname) {
  return /(^|\/)[^/]+-[A-Za-z0-9_-]+\.(js|css|png|svg|ico|woff2)$/.test(pathname);
}

function buildCacheControl(pathname) {
  if (pathname === '/env-config.js' || pathname === '/' || pathname.endsWith('.html')) {
    return 'no-store, no-cache, must-revalidate';
  }

  if (isHashedAsset(pathname)) {
    return 'public, max-age=31536000, immutable';
  }

  if (/\.(js|css|png|svg|ico|woff2|webmanifest|json)$/.test(pathname)) {
    return 'public, max-age=86400, must-revalidate';
  }

  return 'no-store, no-cache, must-revalidate';
}

function isProxyPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/socket.io' || pathname.startsWith('/socket.io/');
}

function getForwardedProto(req) {
  const header = `${req?.headers?.['x-forwarded-proto'] || ''}`.split(',')[0].trim();
  if (header) return header;
  return req?.socket?.encrypted ? 'https' : 'http';
}

function buildProxyHeaders(req, targetUrl, preserveUpgrade = false) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];
  delete headers['transfer-encoding'];
  if (!preserveUpgrade) {
    delete headers.upgrade;
    delete headers['sec-websocket-key'];
    delete headers['sec-websocket-version'];
    delete headers['sec-websocket-protocol'];
    delete headers['sec-websocket-extensions'];
  }

  headers.host = targetUrl.host;
  headers['x-forwarded-host'] = `${req.headers.host || ''}`;
  headers['x-forwarded-proto'] = getForwardedProto(req);

  const existingForwardedFor = `${req.headers['x-forwarded-for'] || ''}`
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const remoteAddress = req.socket?.remoteAddress;
  if (remoteAddress) {
    headers['x-forwarded-for'] = [...existingForwardedFor, remoteAddress].join(', ');
  }

  return headers;
}

function proxyError(resOrSocket, errorMessage) {
  if ('writeHead' in resOrSocket) {
    const res = resOrSocket;
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ statusCode: 502, message: errorMessage }));
    return;
  }

  resOrSocket.destroy();
}

function proxyHttpRequest(req, res, targetUrl) {
  const upstreamUrl = new URL(req.url || '/', targetUrl);
  const client = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const proxyReq = client(
    upstreamUrl,
    {
      method: req.method,
      headers: buildProxyHeaders(req, targetUrl),
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    proxyError(res, `Upstream unavailable: ${err.message}`);
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head, targetUrl) {
  const upstreamUrl = new URL(req.url || '/', targetUrl);
  const client = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;
  const proxyReq = client(upstreamUrl, {
    method: req.method,
    headers: buildProxyHeaders(req, targetUrl, true),
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode || 101} ${proxyRes.statusMessage || 'Switching Protocols'}\r\n`;
    const headers = Object.entries(proxyRes.headers)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\r\n');
    socket.write(`${statusLine}${headers}\r\n\r\n`);
    if (proxyHead?.length) socket.write(proxyHead);
    if (head?.length) proxySocket.write(head);
    proxySocket.pipe(socket).pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
}

function buildContentSecurityPolicy() {
  const appOrigins = unique([
    'self',
    parseAbsoluteOrigin(process.env.VITE_API_URL),
    parseAbsoluteOrigin(process.env.VITE_GATEWAY_URL),
    parseAbsoluteOrigin(process.env.PWA_API_PROXY_TARGET),
    parseAbsoluteOrigin(process.env.VITE_DEV_PROXY_TARGET),
  ]);
  const connectSrc = unique([
    "'self'",
    ...appOrigins.filter((origin) => origin !== 'self'),
    ...GOOGLE_ORIGINS.slice(0, 3),
  ]);
  const scriptSrc = unique([
    "'self'",
    "'unsafe-inline'",
    ...GOOGLE_ORIGINS.slice(0, 2),
  ]);
  const styleSrc = ["'self'", "'unsafe-inline'"];
  const imgSrc = unique([
    "'self'",
    'data:',
    'blob:',
    ...GOOGLE_ORIGINS.slice(3),
  ]);

  return [
    "default-src 'self'",
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self' https://accounts.google.com`,
    `connect-src ${connectSrc.join(' ')}`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    `font-src 'self' data:`,
    `frame-src 'self' https://accounts.google.com`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ].join('; ');
}

function writeSecurityHeaders(res, pathname, req) {
  const headers = {
    'Content-Security-Policy': buildContentSecurityPolicy(),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  };

  const forwardedProto = `${req?.headers?.['x-forwarded-proto'] || ''}`.toLowerCase();
  if (IS_PROD || forwardedProto.includes('https')) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  headers['Cache-Control'] = buildCacheControl(pathname);

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function finishResponse(res, statusCode, pathname, req, headers = {}) {
  writeSecurityHeaders(res, pathname, req);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.writeHead(statusCode);
}

function serveEnvConfig(res, req) {
  const path = join(ROOT, 'env-config.js');
  generateRuntimeConfig(path);
  const body = readFileSync(path);
  finishResponse(res, 200, '/env-config.js', req, {
    'Content-Type': 'application/javascript; charset=utf-8',
  });
  res.end(body);
}

function serveStatic(pathname, res, req) {
  if (isHiddenPath(pathname)) {
    finishResponse(res, 404, pathname, req, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const indexPath = join(ROOT, 'index.html');
    if (!existsSync(indexPath)) {
      finishResponse(res, 500, '/index.html', req, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('index.html not found');
      return;
    }
    finishResponse(res, 200, '/index.html', req, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(indexPath));
    return;
  }

  const ext = extname(filePath);
  finishResponse(res, 200, pathname, req, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

const configuredKeys = ['VITE_API_URL', 'VITE_GOOGLE_CLIENT_ID', 'PWA_API_PROXY_TARGET', 'VITE_GATEWAY_URL', 'VITE_DEV_PROXY_TARGET'].filter(
  (k) => process.env[k] !== undefined && process.env[k] !== '',
);
console.log(
  `Runtime env keys from App Service: ${configuredKeys.length ? configuredKeys.join(', ') : '(none — set Application Settings)'}`,
);

generateRuntimeConfig(join(ROOT, 'env-config.js'));

const proxyTargetUrl = parseTargetUrl(PWA_API_PROXY_TARGET);
if (PWA_API_PROXY_TARGET && !proxyTargetUrl) {
  console.warn(`Invalid PWA_API_PROXY_TARGET ignored: ${PWA_API_PROXY_TARGET}`);
}

createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];

  if (pathname === '/env-config.js') {
    serveEnvConfig(res, req);
    return;
  }

  if (proxyTargetUrl && isProxyPath(pathname)) {
    proxyHttpRequest(req, res, proxyTargetUrl);
    return;
  }

  serveStatic(pathname, res, req);
}).on('upgrade', (req, socket, head) => {
  const pathname = (req.url ?? '/').split('?')[0];
  if (proxyTargetUrl && pathname.startsWith('/socket.io')) {
    proxyUpgrade(req, socket, head, proxyTargetUrl);
    return;
  }
  socket.destroy();
}).listen(PORT, () => {
  console.log(`Play4Cash PWA listening on port ${PORT}`);
});
