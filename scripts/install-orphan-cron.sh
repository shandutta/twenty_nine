#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CRON_MARKER="# twentynine-orphan-check"
CRON_SCHEDULE="${TWENTYNINE_ORPHAN_CRON:-15 4 * * *}"
CRON_CMD="${ROOT_DIR}/scripts/check-orphan-next.sh --fix ${CRON_MARKER}"

CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "$CURRENT_CRON" | grep -Fq "$CRON_MARKER"; then
  echo "install-orphan-cron: entry already present"
  exit 0
fi

{
  echo "$CURRENT_CRON" | sed '/^$/d'
  echo "${CRON_SCHEDULE} ${CRON_CMD}"
} | crontab -

echo "install-orphan-cron: installed (${CRON_SCHEDULE})"
