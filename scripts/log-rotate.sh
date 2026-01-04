#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-}"
MAX_BYTES="${2:-5242880}"
KEEP_COUNT="${3:-5}"

if [ -z "$LOG_FILE" ]; then
  echo "usage: log-rotate.sh <log_file> [max_bytes] [keep_count]" >&2
  exit 1
fi

if [ ! -f "$LOG_FILE" ]; then
  exit 0
fi

size_bytes() {
  if stat -c%s "$LOG_FILE" >/dev/null 2>&1; then
    stat -c%s "$LOG_FILE"
  else
    stat -f%z "$LOG_FILE"
  fi
}

SIZE="$(size_bytes || echo 0)"
if [ "${SIZE:-0}" -lt "$MAX_BYTES" ]; then
  exit 0
fi

if [ "$KEEP_COUNT" -lt 1 ]; then
  KEEP_COUNT=1
fi

idx="$KEEP_COUNT"
while [ "$idx" -gt 1 ]; do
  prev=$((idx - 1))
  if [ -f "$LOG_FILE.$prev" ]; then
    mv -f "$LOG_FILE.$prev" "$LOG_FILE.$idx"
  fi
  idx="$prev"
done

mv -f "$LOG_FILE" "$LOG_FILE.1"
: > "$LOG_FILE"
