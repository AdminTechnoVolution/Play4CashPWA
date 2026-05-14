---
name: version-bump-reminder
description: At the end of every code change in this PWA repository, remind the user to bump the app version before pushing to GitHub. Use after any modification to files under /Users/darricordoba/Documents/GitHub/Play4CashPWA (source, tests, configs, docs, assets), including refactors, bug fixes, new features, and dependency updates. Trigger whenever the conversation is about to wrap up a PWA edit and before the user might run git push, git commit, or deploy.
---

# Version Bump Reminder (Play4CashPWA)

## When to apply

After completing any change to files inside the `Play4CashPWA` repository, append a reminder block to the final assistant message **before** the user is likely to push to GitHub or deploy to Azure App Service. Apply even when the change is small (typo, single-line edit, CSS tweak).

Do **not** apply when:
- The change is purely in `Play4CashApi` or `Play4CashGateway` (different repos, different version policy).
- The user is only asking questions / reading code without editing the PWA.
- The user has already run a `version:bump` command in the same turn.

## What to output

Append exactly this block to the end of the final assistant message that wraps up a PWA change. Keep it verbatim so the cadence is recognizable across sessions:

```
---

**Reminder — before pushing to GitHub, bump the PWA version:**

```bash
npm run version:bump:patch   # 1.0.1 → 1.0.2
npm run version:bump:minor   # 1.0.1 → 1.1.0
npm run version:bump:major   # 1.0.1 → 2.0.0
```

Then commit `package.json` + `package-lock.json` and push.
```

## Rationale (context for the agent)

- The PWA build reads `package.json.version` at build time via `vite.config.ts` and injects it as `__APP_VERSION__` / `__APP_FULL_VERSION__` for the menu footer label and version-gate handshake.
- The GitHub Actions workflow (`.github/workflows/main_p4c-web.yml`) does **not** auto-bump the version. Without a manual bump, two consecutive deploys can ship with the same semver, making it harder to correlate user-reported issues with a specific release.
- The git SHA still distinguishes builds visually (`v1.0.1+abc1234`), but the semver is what `PWA_MIN_VERSION` on the API / Gateway compares against for forced updates.

## Examples

**Triggers the reminder:**
- "Fix the typo in DashboardPage"
- "Add a new icon to the side menu"
- "Update package.json to add a dependency"
- "Bump the i18n labels for the new screen"

**Does NOT trigger the reminder:**
- "Explain how the auth refresh works"
- "Add a new field to the API user schema" (different repo)
- The user already ran `npm run version:bump:patch` earlier in this conversation
