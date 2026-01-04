#!/usr/bin/env bash
set -euo pipefail

DEV_PORT="${TWENTYNINE_DEV_PORT:-3101}"
PROD_PORT="${TWENTYNINE_PROD_PORT:-3100}"
MODE="check"

usage() {
  cat <<'EOF'
Usage: scripts/check-orphan-next.sh [--fix] [--dry-run]

Checks for Next.js dev/start processes running on unexpected ports.

Environment overrides:
  TWENTYNINE_DEV_PORT   default 3101
  TWENTYNINE_PROD_PORT  default 3100
EOF
}

log() {
  echo "[orphan-check] $*"
}

for arg in "$@"; do
  case "$arg" in
    --fix)
      MODE="fix"
      ;;
    --dry-run)
      MODE="check"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log "unknown argument: $arg"
      usage
      exit 2
      ;;
  esac
done

is_next_dev() {
  [[ "$1" =~ (^|[[:space:]])next(\.js)?[[:space:]]+dev([[:space:]]|$) ]]
}

is_next_start() {
  [[ "$1" =~ (^|[[:space:]])next(\.js)?[[:space:]]+start([[:space:]]|$) ]]
}

extract_port() {
  local args="$1"
  if [[ "$args" =~ --port[=[:space:]]*([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  if [[ "$args" =~ PORT=([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  echo ""
}

kill_or_report() {
  local pid="$1"
  local reason="$2"
  if [ "$MODE" = "fix" ]; then
    log "killing pid=$pid ($reason)"
    kill -TERM "$pid" 2>/dev/null || true
    return 0
  fi
  log "orphan pid=$pid ($reason)"
  return 1
}

found_issue=0

while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  [ -z "$line" ] && continue
  pid="${line%% *}"
  args="${line#* }"
  [ -z "$pid" ] && continue

  if is_next_dev "$args"; then
    port=$(extract_port "$args")
    if [ "$port" != "$DEV_PORT" ]; then
      kill_or_report "$pid" "next dev on port ${port:-unknown} (expected ${DEV_PORT})" || found_issue=1
    fi
    continue
  fi

  if is_next_start "$args"; then
    port=$(extract_port "$args")
    if [ "$port" != "$PROD_PORT" ]; then
      kill_or_report "$pid" "next start on port ${port:-unknown} (expected ${PROD_PORT})" || found_issue=1
    fi
    continue
  fi
done < <(ps -eo pid=,args=)

if [ "$MODE" != "fix" ] && [ "$found_issue" -ne 0 ]; then
  exit 1
fi

exit 0
