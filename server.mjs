import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRuntimeConfig } from './scripts/generate-runtime-config.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || process.env.WEBSITES_PORT || 8080);
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
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

function buildContentSecurityPolicy() {
  const appOrigins = unique([
    'self',
    parseAbsoluteOrigin(process.env.VITE_API_URL),
    parseAbsoluteOrigin(process.env.VITE_GATEWAY_URL),
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

const configuredKeys = ['VITE_API_URL', 'VITE_GOOGLE_CLIENT_ID'].filter(
  (k) => process.env[k] !== undefined && process.env[k] !== '',
);
console.log(
  `Runtime env keys from App Service: ${configuredKeys.length ? configuredKeys.join(', ') : '(none — set Application Settings)'}`,
);

generateRuntimeConfig(join(ROOT, 'env-config.js'));

createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];

  if (pathname === '/env-config.js') {
    serveEnvConfig(res, req);
    return;
  }

  serveStatic(pathname, res, req);
}).listen(PORT, () => {
  console.log(`Play4Cash PWA listening on port ${PORT}`);
});
