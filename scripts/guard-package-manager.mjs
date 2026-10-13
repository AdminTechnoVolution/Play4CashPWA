// This repo's local node_modules is pnpm-managed (pnpm-lock.yaml, pnpm-workspace.yaml).
// Running a plain `npm install` here doesn't error out — it silently re-flattens
// pnpm's symlinked node_modules into npm's nested layout, which breaks Vite's dev
// server with cryptic `ENOTDIR: not a directory, open '.../client.mjs/'` errors.
//
// A failing `preinstall` script does NOT stop npm from writing to node_modules
// (verified empirically against npm 11 — it prints the error and proceeds anyway),
// so blocking at that stage doesn't work. Instead: `preinstall` warns early, and
// `postinstall` self-heals by re-running `pnpm install` once npm has finished,
// restoring the correct symlinked layout automatically.
//
// CI legitimately uses `npm ci` (see .github/workflows/*.yml) against the committed
// package-lock.json, so CI is exempted via the CI env var GitHub Actions sets.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const stage = process.argv[2];
const usingNpm = !/pnpm/.test(process.env.npm_execpath || '');

if (process.env.CI || !usingNpm) {
  process.exit(0);
}

if (stage === 'preinstall') {
  console.error(
    '\n⚠ This repo uses pnpm for local development — plain `npm install` corrupts it.\n' +
      '  Continuing anyway; `postinstall` will auto-repair with `pnpm install` afterward.\n' +
      '  Next time, run: pnpm install\n',
  );
  process.exit(0);
}

if (stage === 'postinstall') {
  console.error(
    '\n↻ Detected npm install in a pnpm-managed repo — rebuilding node_modules with `pnpm install`...\n' +
      '  (a plain `pnpm install` alone would report "already up to date" here and skip repairing\n' +
      '  the symlinks npm just flattened, so node_modules is removed first for a clean rebuild.)\n',
  );
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  rmSync(join(projectRoot, 'node_modules'), { recursive: true, force: true });
  const result = spawnSync('pnpm', ['install'], { stdio: 'inherit', cwd: projectRoot });
  if (result.status !== 0) {
    console.error(
      '\n✖ Auto-repair failed. Run `pnpm install` manually to fix node_modules.\n',
    );
    process.exit(result.status ?? 1);
  }
  console.error('\n✓ node_modules repaired back to pnpm layout.\n');
}
