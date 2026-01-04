#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/pre-push.log"
export TZ="America/Los_Angeles"
RUN_TS=$(date +"%Y-%m-%dT%H:%M:%S%z")

exec 3>&1 4>&2
log_console() { echo "$@" >&3; }

"$ROOT_DIR/scripts/log-rotate.sh" "$LOG_FILE" "${TWENTYNINE_LOG_MAX_BYTES:-5242880}" "${TWENTYNINE_LOG_KEEP:-5}"

{
  echo "----"
  echo "pre-push: started $RUN_TS"
} >> "$LOG_FILE"
log_console "pre-push: started $RUN_TS (log: $LOG_FILE)"

if [ "${TWENTYNINE_LOG_STDOUT:-0}" = "1" ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  exec >> "$LOG_FILE" 2>&1
fi

trap 'status=$?; if [ $status -eq 0 ]; then log_console "pre-push: ok (log: '"$LOG_FILE"')"; else log_console "pre-push: failed (exit $status) (log: '"$LOG_FILE"')"; fi' EXIT

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "pre-push: skip (branch $BRANCH)"
  exit 0
fi

if [ "${TWENTYNINE_SKIP_PREPUSH:-0}" = "1" ]; then
  echo "pre-push: skipped (TWENTYNINE_SKIP_PREPUSH=1)"
  exit 0
fi

echo "pre-push: running prettier check"
pnpm format:check

echo "pre-push: running lint"
pnpm lint

echo "pre-push: running unit tests"
pnpm test

echo "pre-push: building web app"
pnpm -C apps/web build

if [ "${TWENTYNINE_PREPUSH_E2E:-1}" = "1" ]; then
  echo "pre-push: running e2e tests"
  E2E_PORT="${E2E_PORT:-3101}" E2E_SCREENSHOTS=0 pnpm -C apps/web test:e2e
else
  echo "pre-push: e2e skipped (TWENTYNINE_PREPUSH_E2E=0)"
fi
