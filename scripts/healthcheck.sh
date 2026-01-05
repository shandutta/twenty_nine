#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

export PATH="/home/shan/.nvm/versions/node/v24.12.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export COREPACK_HOME="${COREPACK_HOME:-/home/shan/twentynine/.corepack-cache}"
export TZ="America/Los_Angeles"

mkdir -p "$ROOT_DIR/.logs"
LOG_FILE="$ROOT_DIR/.logs/healthcheck.log"
RUN_TS=$(date +"%Y-%m-%dT%H:%M:%S%z")

exec 3>&1 4>&2
log_console() { echo "$@" >&3; }

"$ROOT_DIR/scripts/log-rotate.sh" "$LOG_FILE" "${TWENTYNINE_LOG_MAX_BYTES:-5242880}" "${TWENTYNINE_LOG_KEEP:-5}"

{
  echo "----"
  echo "healthcheck: started $RUN_TS"
} >> "$LOG_FILE"
log_console "healthcheck: started $RUN_TS (log: $LOG_FILE)"

if [ "${TWENTYNINE_LOG_STDOUT:-0}" = "1" ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
else
  exec >> "$LOG_FILE" 2>&1
fi

trap 'status=$?; if [ $status -eq 0 ]; then log_console "healthcheck: ok (log: '"$LOG_FILE"')"; else log_console "healthcheck: failed (exit $status) (log: '"$LOG_FILE"')"; fi' EXIT

node scripts/verify-next-build.mjs

if ! command -v curl >/dev/null 2>&1; then
  echo "healthcheck: curl not available" >&2
  exit 1
fi

extract_next_scripts() {
  local html_file="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -o "/_next/[^\"']+\\.js" "$html_file" 2>/dev/null | sort -u
  else
    grep -oE "/_next/[^\"']+\\.js" "$html_file" 2>/dev/null | sort -u
  fi
}

check_game_bundle() {
  local base_url="$1"
  local curl_flags=("-fsS")
  local tmp_html
  tmp_html=$(mktemp)

  if [ "${TWENTYNINE_HEALTH_INSECURE:-0}" = "1" ]; then
    curl_flags+=("-k")
  fi

  curl "${curl_flags[@]}" -o "$tmp_html" "${base_url}/game"

  mapfile -t next_scripts < <(extract_next_scripts "$tmp_html" || true)
  rm -f "$tmp_html"

  if [ "${#next_scripts[@]}" -eq 0 ]; then
    echo "healthcheck: no _next scripts found at ${base_url}/game" >&2
    exit 1
  fi

  for next_script in "${next_scripts[@]}"; do
    if ! curl "${curl_flags[@]}" -o /dev/null "${base_url}${next_script}"; then
      echo "healthcheck: failed to load ${base_url}${next_script}" >&2
      exit 1
    fi
  done
}

check_game_bundle "http://127.0.0.1:${TWENTYNINE_HEALTH_PORT:-3100}"

if [ -n "${TWENTYNINE_HEALTH_PUBLIC_URL:-}" ]; then
  check_game_bundle "${TWENTYNINE_HEALTH_PUBLIC_URL}"
fi
