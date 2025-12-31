#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "deploy: skip (branch $BRANCH)"
  exit 0
fi

CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD)
if ! echo "$CHANGED" | grep -Eq '^(apps/web/|packages/engine/|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)'; then
  echo "deploy: no relevant changes; skipping"
  exit 0
fi

if echo "$CHANGED" | grep -Eq '(^pnpm-lock\.yaml|^package\.json|^apps/web/package\.json|^packages/engine/package\.json|^pnpm-workspace\.yaml)'; then
  echo "deploy: installing dependencies"
  pnpm install
fi

if [ "${TWENTYNINE_DEPLOY_CHECKS:-1}" = "1" ]; then
  echo "deploy: running prettier check"
  pnpm format:check

  echo "deploy: running lint"
  pnpm lint

  echo "deploy: running unit tests"
  pnpm test

  if [ "${TWENTYNINE_DEPLOY_E2E:-1}" = "1" ]; then
    echo "deploy: running e2e tests"
    E2E_PORT="${E2E_PORT:-3101}" E2E_SCREENSHOTS=0 pnpm -C apps/web test:e2e
  fi
fi

echo "deploy: building web app"
pnpm -C apps/web build

if ! sudo -n true 2>/dev/null; then
  echo "deploy: sudo is required to restart the service." >&2
  echo "deploy: run 'sudo systemctl restart twentynine' manually." >&2
  exit 1
fi

echo "deploy: restarting twentynine service"
sudo -n systemctl restart twentynine
echo "deploy: done"
