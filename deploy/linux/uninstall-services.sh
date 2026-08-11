#!/bin/bash
# Stops and removes the auto-start systemd --user services installed by
# install-services.sh. Nothing about the app itself is deleted.
#
# Usage: ./deploy/linux/uninstall-services.sh
set -euo pipefail

UNIT_DIR="$HOME/.config/systemd/user"

for name in backend frontend caddy; do
  unit="ragchatbot-$name.service"
  if [ -f "$UNIT_DIR/$unit" ]; then
    systemctl --user disable --now "$unit" 2>/dev/null || true
    rm -f "$UNIT_DIR/$unit"
    echo "Removed $unit"
  else
    echo "$unit was not installed"
  fi
done
systemctl --user daemon-reload
