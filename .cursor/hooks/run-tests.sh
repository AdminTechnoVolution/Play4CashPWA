#!/bin/bash
# stop hook: runs unit + integration tests for the Play4Cash repos that have pending
# changes (per `git status --porcelain`). Reports failures back to the agent via
# `additional_context` so it self-corrects before finishing the turn.
#
# Manual invocation:
#   .cursor/hooks/run-tests.sh                # auto-detect changed repos, run unit + e2e
#   .cursor/hooks/run-tests.sh --all          # run every suite, regardless of git status
#   .cursor/hooks/run-tests.sh --unit-only    # skip integration / e2e
#   .cursor/hooks/run-tests.sh --repo pwa     # limit to a single repo (pwa|api|gateway)
set -u

PWA_DIR="/Users/darricordoba/Documents/GitHub/Play4CashPWA"
API_DIR="/Users/darricordoba/Documents/GitHub/Play4CashApi"
GATEWAY_DIR="/Users/darricordoba/Documents/GitHub/Play4CashGateway"

MODE_ALL=0
MODE_UNIT_ONLY=0
ONLY_REPO=""

while [ $# -gt 0 ]; do
  case "$1" in
    --all) MODE_ALL=1 ;;
    --unit-only) MODE_UNIT_ONLY=1 ;;
    --repo) shift; ONLY_REPO="${1:-}" ;;
    *) ;; # silently ignore unknown flags so the hook surface stays forgiving
  esac
  shift
done

# Returns 0 if the given git repo has any pending changes under src/ or test/, 1 otherwise.
repo_has_changes() {
  local dir="$1"
  [ -d "$dir/.git" ] || return 1
  ( cd "$dir" && git status --porcelain -- src test 2>/dev/null | grep -q . )
}

should_run() {
  local repo_key="$1" repo_dir="$2"
  if [ -n "$ONLY_REPO" ]; then [ "$ONLY_REPO" = "$repo_key" ]; return $?; fi
  [ $MODE_ALL -eq 1 ] && return 0
  repo_has_changes "$repo_dir"
}

FAILURES=""
record_failure() {
  local label="$1" output="$2"
  FAILURES="${FAILURES}\n--- ${label} ---\n${output}\n"
}

run_cmd() {
  local label="$1" dir="$2"; shift 2
  local out status
  out=$(cd "$dir" && "$@" 2>&1)
  status=$?
  if [ $status -ne 0 ]; then
    record_failure "$label" "$(printf '%s\n' "$out" | tail -n 40)"
  fi
}

if should_run pwa "$PWA_DIR"; then
  run_cmd "PWA · npm test" "$PWA_DIR" npm test --silent
fi

if should_run api "$API_DIR"; then
  run_cmd "API · npm test" "$API_DIR" npm test --silent
  if [ $MODE_UNIT_ONLY -eq 0 ]; then
    run_cmd "API · npm run test:e2e" "$API_DIR" npm run test:e2e --silent
  fi
fi

if should_run gateway "$GATEWAY_DIR"; then
  run_cmd "Gateway · npm test" "$GATEWAY_DIR" npm test --silent
  if [ $MODE_UNIT_ONLY -eq 0 ]; then
    run_cmd "Gateway · npm run test:e2e" "$GATEWAY_DIR" npm run test:e2e --silent
  fi
fi

if [ -z "$FAILURES" ]; then
  echo '{}'
  exit 0
fi

# Build the additional_context payload safely via python so the multi-line / quoted
# tail of jest output doesn't break JSON encoding.
export FAILS_ENV="$FAILURES"
if command -v python3 >/dev/null 2>&1; then
  python3 -c '
import json, os
fails = os.environ.get("FAILS_ENV", "")
msg = (
  "Test suite(s) failed for the modified Play4Cash repo(s). Fix before finishing this turn:\n"
  "```\n" + fails + "\n```"
)
print(json.dumps({"additional_context": msg}))
'
else
  printf '{"additional_context":"Test suite(s) failed. See terminal output."}\n'
fi
exit 0
