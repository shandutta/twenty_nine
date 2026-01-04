#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CRON_MARKER="# twentynine-healthcheck"
CRON_SCHEDULE="${TWENTYNINE_HEALTH_CRON:-*/10 * * * *}"
CRON_CMD="${ROOT_DIR}/scripts/healthcheck.sh ${CRON_MARKER}"

CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRON" | grep -Fq "$CRON_MARKER"; then
  echo "install-health-cron: entry already present"
  exit 0
fi

{
  echo "$CURRENT_CRON" | sed '/^$/d'
  echo "${CRON_SCHEDULE} ${CRON_CMD}"
} | crontab -

echo "install-health-cron: installed (${CRON_SCHEDULE})"
