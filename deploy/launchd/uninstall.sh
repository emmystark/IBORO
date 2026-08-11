#!/bin/bash
# Stops and removes the auto-boot LaunchAgents installed by install.sh.
#
# Usage: ./deploy/launchd/uninstall.sh
set -euo pipefail

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

for name in backend frontend caddy; do
  plist="$LAUNCH_AGENTS_DIR/com.ragchatbot.$name.plist"
  if [ -f "$plist" ]; then
    launchctl unload "$plist" 2>/dev/null || true
    rm -f "$plist"
    echo "✓ Removed com.ragchatbot.$name"
  else
    echo "com.ragchatbot.$name was not installed"
  fi
done
