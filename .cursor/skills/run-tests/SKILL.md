---
name: run-tests
description: Runs unit + integration tests across Play4CashPWA, Play4CashApi, and Play4CashGateway after every code change. Use after modifying any source file in those three repos, before declaring a request complete.
alwaysApply: true
---

# Run tests after every adjustment

This skill is mandatory at the end of every coding turn that touches `src/` or `test/` in
any of the three Play4Cash repos. It complements (does not replace) the `tsc --noEmit`
step described in `agent-workflow.mdc`.

The hook `.cursor/hooks/run-tests.sh` enforces a fast version of this procedure on `stop`,
but the agent must also invoke it manually (or run the equivalent commands) BEFORE that
hook fires, so failures are surfaced inside the turn and not as a blocking notification at
the end.

## Project map

| Repo | Path | Unit test command | Integration / e2e command |
|---|---|---|---|
| PWA | `/Users/darricordoba/Documents/GitHub/Play4CashPWA` | `npm test` (vitest) | (none — vitest covers all) |
| API | `/Users/darricordoba/Documents/GitHub/Play4CashApi` | `npm test` (jest) | `npm run test:e2e` |
| Gateway | `/Users/darricordoba/Documents/GitHub/Play4CashGateway` | `npm test` (jest, runInBand) | `npm run test:e2e` |

All three commands print pass/fail counts. Treat any non-zero exit code as a hard failure.

## Procedure (what the agent must do at the end of each turn)

1. Identify which repos were modified in the current turn (any file under `src/`, `test/`,
   or top-level config). Skip the repos you did not touch — running tests for unmodified
   repos wastes time.
2. For each modified repo, run its **unit** command. If it fails, fix and re-run; do not
   move on until it is green.
3. For modified repos that also have an `integration` command (API, Gateway), run it.
4. If you only changed docs (`docs/`, `*.md`, `.cursor/rules/`), you may skip steps 2–3.
5. Never declare the turn complete with a failing suite. If a fix is out of scope, list
   the failing tests in the user-facing summary and ask before continuing.

## Fast invocation

Use the project-aware helper instead of remembering paths:

```bash
.cursor/hooks/run-tests.sh
```

This script (run from the PWA repo) auto-detects which of the three repos have changes
via `git status --porcelain` and runs only the relevant suites. It is the same script the
`stop` hook executes; running it manually first lets you see and fix failures live.

Pass-through flags:

- `--all` — run every suite regardless of git status (use after pulling main).
- `--unit-only` — skip integration / e2e (useful for quick iterations).
- `--repo pwa|api|gateway` — limit to a single repo.

## Why both unit AND integration

- **Unit** suites cover guards, interceptors, services, semver, and the version-handshake
  utilities. They run in <2s with warm cache.
- **Integration / e2e** suites cover the cross-cutting contracts that unit tests cannot
  prove on their own:
  - API: `X-App-Min-Version` middleware end-to-end, `/admin/app-versions/stats`
    contract incl. 503 when Redis is degraded.
  - Gateway: CORS `Access-Control-Expose-Headers` + preflight `Allow-Headers`, which is
    the source of truth the PWA depends on.

Skipping integration tests after touching auth, sockets, CORS, or the version contract is
a defect waiting to happen — those are exactly the seams the integration tests cover.

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Gateway hangs >100s on first run | ts-jest cold start | Wait it out; second run is <1s thanks to jest cache. |
| API e2e returns 403 | Forgot to override `RolesGuard` in test module | See `test/app-version.e2e-spec.ts` for the pattern. |
| Vitest can't resolve `virtual:pwa-register/react` | New spec imported a SW-aware module | Add the alias in `vitest.config.ts`, or `vi.mock` the module before importing. |
| `unhandledRejection` from interceptor record() | Background task not catching its own promise | Always wrap fire-and-forget calls with `.catch(() => …)`. |

## Forbidden patterns

- ❌ Closing a turn with a red suite "to be fixed later".
- ❌ Running only the file you touched (`jest path/to/file.spec.ts`) and assuming the rest
  still passes — Nest's DI cross-couples specs more than you'd think.
- ❌ Disabling `--forceExit` on the API or Gateway e2e scripts; the original Nest
  scaffolds leak handles and hang CI without it.
- ❌ Adding new specs without verifying they run via the global `npm test` of that repo
  (vitest/jest config patterns, glob include).
