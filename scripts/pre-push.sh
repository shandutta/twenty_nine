#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/pre-push.log"
LOCK_FILE="$ROOT_DIR/.logs/deploy.lock"
LAST_DEPLOY_FILE="$ROOT_DIR/.logs/last-deploy.sha"
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

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  LOCK_WAIT="${TWENTYNINE_PREPUSH_LOCK_WAIT:-0}"
  if [ "$LOCK_WAIT" = "0" ]; then
    if ! flock -n 9; then
      echo "pre-push: skipped (deploy lock is held)"
      exit 0
    fi
  else
    if ! flock -w "$LOCK_WAIT" 9; then
      echo "pre-push: timed out waiting for deploy lock"
      exit 0
    fi
  fi
fi

if [ "${TWENTYNINE_PREPUSH_SKIP_DEPLOYED:-1}" = "1" ] && [ -f "$LAST_DEPLOY_FILE" ]; then
  LAST_DEPLOY_SHA=$(cat "$LAST_DEPLOY_FILE" 2>/dev/null || true)
  HEAD_SHA=$(git rev-parse HEAD)
  if [ -n "$LAST_DEPLOY_SHA" ] && [ "$LAST_DEPLOY_SHA" = "$HEAD_SHA" ]; then
    echo "pre-push: skipped (HEAD already deployed)"
    exit 0
  fi
fi

echo "pre-push: running prettier check"
pnpm format:check

echo "pre-push: running lint"
pnpm lint

echo "pre-push: running unit tests"
pnpm test:engine
pnpm test:web
