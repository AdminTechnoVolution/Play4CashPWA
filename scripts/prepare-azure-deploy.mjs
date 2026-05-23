import { cpSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'azure-deploy');

mkdirSync(join(OUT, 'scripts'), { recursive: true });
cpSync(join(ROOT, 'dist'), join(OUT, 'dist'), { recursive: true });
copyFileSync(join(ROOT, 'server.mjs'), join(OUT, 'server.mjs'));
copyFileSync(
  join(ROOT, 'scripts', 'generate-runtime-config.mjs'),
  join(OUT, 'scripts', 'generate-runtime-config.mjs'),
);

writeFileSync(
  join(OUT, 'package.json'),
  `${JSON.stringify(
    {
      name: 'play4cash-pwa-server',
      private: true,
      type: 'module',
      scripts: { start: 'node server.mjs' },
      engines: { node: '>=20' },
    },
    null,
    2,
  )}\n`,
);

console.log(`Azure deploy package ready at ${OUT}`);
