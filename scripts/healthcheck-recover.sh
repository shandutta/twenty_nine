#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/healthcheck.log"
STAMP_FILE="$ROOT_DIR/.logs/healthcheck-recover.last"
COOLDOWN_MIN="${TWENTYNINE_RECOVER_COOLDOWN_MIN:-15}"
COOLDOWN_SEC=$((COOLDOWN_MIN * 60))
NOW_TS=$(date +%s)

if [ -f "$STAMP_FILE" ]; then
  LAST_TS=$(cat "$STAMP_FILE" 2>/dev/null || echo "")
  if [[ "$LAST_TS" =~ ^[0-9]+$ ]]; then
    DELTA=$((NOW_TS - LAST_TS))
    if [ "$DELTA" -lt "$COOLDOWN_SEC" ]; then
      echo "healthcheck: recover skipped (cooldown ${DELTA}s < ${COOLDOWN_SEC}s)" >> "$LOG_FILE"
      exit 0
    fi
  fi
fi

echo "$NOW_TS" > "$STAMP_FILE"

echo "healthcheck: recover running (cooldown ${COOLDOWN_SEC}s)" >> "$LOG_FILE"
TWENTYNINE_FORCE_DEPLOY=1 TWENTYNINE_DEPLOY_CHECKS=0 TWENTYNINE_DEPLOY_E2E=0 pnpm deploy:prod
