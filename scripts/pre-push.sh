#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "pre-push: skip (branch $BRANCH)"
  exit 0
fi

if [ "${TWENTYNINE_SKIP_PREPUSH:-0}" = "1" ]; then
  echo "pre-push: skipped (TWENTYNINE_SKIP_PREPUSH=1)"
  exit 0
fi

echo "pre-push: running prettier check"
pnpm format:check

echo "pre-push: running lint"
pnpm lint

echo "pre-push: running unit tests"
pnpm test

echo "pre-push: building web app"
pnpm -C apps/web build

if [ "${TWENTYNINE_PREPUSH_E2E:-1}" = "1" ]; then
  echo "pre-push: running e2e tests"
  E2E_PORT="${E2E_PORT:-3101}" E2E_SCREENSHOTS=0 pnpm -C apps/web test:e2e
else
  echo "pre-push: e2e skipped (TWENTYNINE_PREPUSH_E2E=0)"
fi
