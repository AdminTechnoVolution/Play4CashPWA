---
name: version-bump-reminder
description: After PWA edits, remind about semver when a manual bump matters — CI auto-increments patch on production deploy from main; minor/major still need local bumps before merge.
---

# Version Bump Reminder (Play4CashPWA)

## When to apply

After completing substantive changes inside `Play4CashPWA`, append the reminder block below **when** the user is likely to care about semver before the next production deploy — for example breaking UX/API assumptions, coordinated releases with `PWA_MIN_VERSION`, or shipping a **minor/major** jump.

Do **not** apply when:

- The change is purely in `Play4CashApi` or `Play4CashGateway`.
- The user is only asking questions / reading code without editing the PWA.
- The user already ran the appropriate `version:bump:*` in the same turn.

**Routine merges to `main`:** do **not** insist on a manual **patch** bump — the GitHub Actions workflow runs `npm version patch --no-git-tag-version` before `npm run build` and pushes `[skip ci]` so each Azure deploy gets a fresh patch.

## What to output

Append exactly this block when the reminder applies (no nested fences):

```
---

**Versión del PWA**

- Cada deploy desde `main` sube el **patch** automáticamente en CI (`main_p4c-web.yml`).
- Para **minor** o **major** antes del merge, en la repo: `npm run version:bump:minor` o `npm run version:bump:major`, luego commit de `package.json` + `package-lock.json`.
```

## Rationale (context for the agent)

- `vite.config.ts` injects `package.json.version` as `__APP_VERSION__` / `__APP_FULL_VERSION__`.
- CI bumps **patch** per successful deploy on `main`, then commits `package.json` + `package-lock.json` with `[skip ci]` (needs branch-rule allowance for `github-actions[bot]` if `main` is protected).
- `PWA_MIN_VERSION` on API/Gateway compares against that semver; git SHA still appears as `+<sha>` in the UI.

## Examples

**Triggers the reminder:**

- Breaking change that should coordinate with `PWA_MIN_VERSION`.
- User asks what version to ship or explicitly wants minor/major.

**Does NOT trigger (routine):**

- Small UI fix merged via PR to `main` — CI handles patch.
- Explain-only questions.
