import { chmodSync, copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'azure-deploy');

function keepExportedPath(srcPath) {
  const relative = srcPath.startsWith(ROOT) ? srcPath.slice(ROOT.length + 1) : srcPath;
  if (!relative) return true;
  return !relative.split('/').some((segment) => segment.startsWith('.') && segment !== '.well-known');
}

// Flat layout: static assets at wwwroot root, served by the hardened Node server.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'dist'), OUT, { recursive: true, filter: keepExportedPath });
mkdirSync(join(OUT, 'scripts'), { recursive: true });
copyFileSync(join(ROOT, 'server.mjs'), join(OUT, 'server.mjs'));
copyFileSync(join(ROOT, 'startup.sh'), join(OUT, 'startup.sh'));
copyFileSync(
  join(ROOT, 'scripts', 'generate-runtime-config.mjs'),
  join(OUT, 'scripts', 'generate-runtime-config.mjs'),
);
chmodSync(join(OUT, 'startup.sh'), 0o755);

writeFileSync(
  join(OUT, 'package.json'),
  `${JSON.stringify(
    {
      name: 'play4cash-pwa-server',
      private: true,
      type: 'module',
      scripts: {
        start: 'bash startup.sh',
        'start:node': 'node server.mjs',
      },
      engines: { node: '>=20' },
    },
    null,
    2,
  )}\n`,
);

console.log(`Azure deploy package ready at ${OUT}`);
