import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRuntimeConfig } from './scripts/generate-runtime-config.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || process.env.WEBSITES_PORT || 8080);

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

function serveEnvConfig(res) {
  const path = join(ROOT, 'env-config.js');
  generateRuntimeConfig(path);
  const body = readFileSync(path);
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(body);
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const indexPath = join(ROOT, 'index.html');
    if (!existsSync(indexPath)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('index.html not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(indexPath));
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
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
    serveEnvConfig(res);
    return;
  }

  serveStatic(pathname, res);
}).listen(PORT, () => {
  console.log(`Play4Cash PWA listening on port ${PORT}`);
});
