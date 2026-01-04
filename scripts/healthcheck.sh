#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

export PATH="/home/shan/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_HOME="${COREPACK_HOME:-/home/shan/twentynine/.corepack-cache}"
export TZ="America/Los_Angeles"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/healthcheck.log"
AUTO_COMMIT_LOG="$ROOT_DIR/.logs/auto-commit.log"
exec > >(tee -a "$LOG_FILE" "$AUTO_COMMIT_LOG") 2>&1
echo "----"
echo "healthcheck: started $(date +"%Y-%m-%dT%H:%M:%S%z")"

node scripts/verify-next-build.mjs

if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${TWENTYNINE_HEALTH_PORT:-3100}/game" >/dev/null
else
  echo "healthcheck: curl not available" >&2
  exit 1
fi
