#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
echo "install-health-cron: deprecated (use systemd timer)"
echo "install-health-cron: enabling twentynine-healthcheck.timer"
sudo systemctl daemon-reload
sudo systemctl enable --now twentynine-healthcheck.timer
