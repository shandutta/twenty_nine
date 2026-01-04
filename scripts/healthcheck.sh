#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

export PATH="/home/shan/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_HOME="${COREPACK_HOME:-/home/shan/twentynine/.corepack-cache}"

mkdir -p "$ROOT_DIR/.logs"

node scripts/verify-next-build.mjs

if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${TWENTYNINE_HEALTH_PORT:-3100}/game" >/dev/null
else
  echo "healthcheck: curl not available" >&2
  exit 1
fi
