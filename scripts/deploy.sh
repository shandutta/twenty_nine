#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/deploy.log"
LOCK_FILE="$ROOT_DIR/.logs/deploy.lock"
LAST_DEPLOY_FILE="$ROOT_DIR/.logs/last-deploy.sha"
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

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  LOCK_WAIT="${TWENTYNINE_DEPLOY_LOCK_WAIT:-0}"
  if [ "$LOCK_WAIT" = "0" ]; then
    if ! flock -n 9; then
      echo "deploy: another deploy is already running (lock: $LOCK_FILE)"
      exit 1
    fi
  else
    if ! flock -w "$LOCK_WAIT" 9; then
      echo "deploy: timed out waiting for deploy lock (lock: $LOCK_FILE)"
      exit 1
    fi
  fi
fi

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
  pnpm test:engine
  pnpm test:web

  if [ "${TWENTYNINE_DEPLOY_E2E:-1}" = "1" ]; then
    echo "deploy: running e2e tests"
    env -u NO_COLOR -u FORCE_COLOR E2E_PORT="${E2E_PORT:-3101}" E2E_SCREENSHOTS=0 pnpm -C apps/web test:e2e
  fi
fi

find_next_lock_pids() {
  local lock_path="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -t "$lock_path" 2>/dev/null || true
    return 0
  fi
  ps -eo pid=,args= | awk '
    /(next dev|next build|next start|next-dev\.mjs|next-start\.mjs)/ {print $1}
  '
}

clear_next_lock() {
  local lock_path="apps/web/.next/lock"
  if [ ! -f "$lock_path" ]; then
    return 0
  fi

  local pids
  pids=$(find_next_lock_pids "$lock_path" || true)
  if [ -n "$pids" ]; then
    if [ "${TWENTYNINE_DEPLOY_STOP_NEXT:-0}" = "1" ]; then
      echo "deploy: stopping active next processes before build"
      for pid in $pids; do
        kill -TERM "$pid" 2>/dev/null || true
      done
      sleep 2
      pids=$(find_next_lock_pids "$lock_path" || true)
      if [ -n "$pids" ]; then
        echo "deploy: next processes still running; aborting"
        return 1
      fi
    else
      echo "deploy: next process detected with existing .next/lock."
      echo "deploy: stop dev/build or set TWENTYNINE_DEPLOY_STOP_NEXT=1 to auto-stop."
      return 1
    fi
  fi

  echo "deploy: removing stale .next/lock"
  rm -f "$lock_path"
}

clear_next_lock

can_sudo() {
  sudo -n true 2>/dev/null
}

service_active() {
  systemctl is-active --quiet twentynine
}

if service_active && ! can_sudo; then
  echo "deploy: twentynine service is active but sudo is unavailable."
  echo "deploy: aborting before build to avoid serving mismatched assets."
  exit 1
fi

if service_active && can_sudo; then
  echo "deploy: stopping twentynine service before build"
  sudo -n systemctl stop twentynine
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

node scripts/verify-next-build.mjs

if ! can_sudo; then
  echo "deploy: sudo is required to restart the service." >&2
  if [ -d "$BACKUP_DIR" ]; then
    echo "deploy: restoring previous build from backup." >&2
    rm -rf apps/web/.next
    mv "$BACKUP_DIR" apps/web/.next
  fi
  exit 1
fi

echo "deploy: restarting twentynine service"
if ! sudo -n systemctl restart twentynine; then
  echo "deploy: restart failed." >&2
  if [ -d "$BACKUP_DIR" ]; then
    echo "deploy: restoring previous build from backup." >&2
    rm -rf apps/web/.next
    mv "$BACKUP_DIR" apps/web/.next
  fi
  exit 1
fi

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

git rev-parse HEAD > "$LAST_DEPLOY_FILE"

rm -rf "$BACKUP_DIR"
echo "deploy: done"
