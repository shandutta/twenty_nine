#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

export PATH="/home/shan/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_HOME="${COREPACK_HOME:-/home/shan/twentynine/.corepack-cache}"
export TZ="America/Los_Angeles"
export PW_BASE_URL="http://127.0.0.1:${TWENTYNINE_HEALTH_PORT:-3100}"
export E2E_NO_WEBSERVER=1
export E2E_SCREENSHOTS=0

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/smoke-e2e.log"
RUN_TS=$(date +"%Y-%m-%dT%H:%M:%S%z")

exec 3>&1 4>&2
log_console() { echo "$@" >&3; }

"$ROOT_DIR/scripts/log-rotate.sh" "$LOG_FILE" "${TWENTYNINE_LOG_MAX_BYTES:-5242880}" "${TWENTYNINE_LOG_KEEP:-5}"

{
  echo "----"
  echo "smoke-e2e: started $RUN_TS"
} >> "$LOG_FILE"
log_console "smoke-e2e: started $RUN_TS (log: $LOG_FILE)"

if [ "${TWENTYNINE_LOG_STDOUT:-0}" = "1" ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  exec >> "$LOG_FILE" 2>&1
fi

trap 'status=$?; if [ $status -eq 0 ]; then log_console "smoke-e2e: ok (log: '"$LOG_FILE"')"; else log_console "smoke-e2e: failed (exit $status) (log: '"$LOG_FILE"')"; fi' EXIT

pnpm -C apps/web test:e2e
