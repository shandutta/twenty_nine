#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/deploy.log"
export TZ="America/Los_Angeles"
RUN_TS=$(date +"%Y-%m-%dT%H:%M:%S%z")

exec 3>&1 4>&2
log_console() { echo "$@" >&3; }

"$ROOT_DIR/scripts/log-rotate.sh" "$LOG_FILE" "${TWENTYNINE_LOG_MAX_BYTES:-5242880}" "${TWENTYNINE_LOG_KEEP:-5}"

{
  echo "----"
  echo "deploy: started $RUN_TS"
} >> "$LOG_FILE"
log_console "deploy: started $RUN_TS (log: $LOG_FILE)"

if [ "${TWENTYNINE_LOG_STDOUT:-0}" = "1" ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  exec >> "$LOG_FILE" 2>&1
fi

trap 'status=$?; if [ $status -eq 0 ]; then log_console "deploy: ok (log: '"$LOG_FILE"')"; else log_console "deploy: failed (exit $status) (log: '"$LOG_FILE"')"; fi' EXIT

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "deploy: skip (branch $BRANCH)"
  exit 0
fi

CHANGED=$(printf "%s\n%s\n" "$(git diff-tree --no-commit-id --name-only -r HEAD)" "$(git diff --name-only HEAD)" | sort -u)
FORCE_DEPLOY="${TWENTYNINE_FORCE_DEPLOY:-0}"
BUILD_ID_PATH="apps/web/.next/BUILD_ID"
if [ ! -f "$BUILD_ID_PATH" ]; then
  echo "deploy: missing $BUILD_ID_PATH; forcing build"
  FORCE_DEPLOY=1
fi

if ! echo "$CHANGED" | grep -Eq '^(apps/web/|packages/engine/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)'; then
  if [ "$FORCE_DEPLOY" != "1" ]; then
    echo "deploy: no relevant changes; skipping"
    exit 0
  fi
  echo "deploy: no relevant changes, but forced build requested"
fi

if echo "$CHANGED" | grep -Eq '(^pnpm-lock\.yaml|^package\.json|^apps/web/package\.json|^packages/engine/package\.json|^pnpm-workspace\.yaml)'; then
  echo "deploy: installing dependencies"
  pnpm install
fi

if [ "${TWENTYNINE_DEPLOY_CHECKS:-1}" = "1" ]; then
  echo "deploy: running prettier (write)"
  pnpm format

  echo "deploy: running lint"
  pnpm lint

  echo "deploy: running unit tests"
  pnpm test

  if [ "${TWENTYNINE_DEPLOY_E2E:-1}" = "1" ]; then
    echo "deploy: running e2e tests"
    env -u NO_COLOR -u FORCE_COLOR E2E_PORT="${E2E_PORT:-3101}" E2E_SCREENSHOTS=0 pnpm -C apps/web test:e2e
  fi
fi

echo "deploy: building web app"
echo "deploy: cleaning previous build"
BACKUP_DIR="apps/web/.next.backup"
if [ -d apps/web/.next ]; then
  rm -rf "$BACKUP_DIR"
  mv apps/web/.next "$BACKUP_DIR"
fi

if ! pnpm -C apps/web build; then
  echo "deploy: build failed"
  rm -rf apps/web/.next
  if [ -d "$BACKUP_DIR" ]; then
    mv "$BACKUP_DIR" apps/web/.next
  fi
  exit 1
fi

rm -rf "$BACKUP_DIR"
node scripts/verify-next-build.mjs

if ! sudo -n true 2>/dev/null; then
  echo "deploy: sudo is required to restart the service." >&2
  echo "deploy: run 'sudo systemctl restart twentynine' manually." >&2
  exit 1
fi

echo "deploy: restarting twentynine service"
sudo -n systemctl restart twentynine
echo "deploy: running health check"
if command -v curl >/dev/null 2>&1; then
  HEALTH_URL="http://127.0.0.1:${TWENTYNINE_HEALTH_PORT:-3100}/game"
  for attempt in $(seq 1 10); do
    if curl -fsS "$HEALTH_URL" >/dev/null; then
      echo "deploy: health check ok"
      break
    fi
    if [ "$attempt" -eq 10 ]; then
      echo "deploy: health check failed after 10 attempts" >&2
      exit 1
    fi
    sleep 1
  done
else
  echo "deploy: curl not available; skipping health check"
fi
echo "deploy: done"
