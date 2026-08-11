#!/bin/bash
# Installs LaunchAgents so the backend and frontend dev servers start
# automatically on login and relaunch after every reboot.
#
# Usage: ./deploy/launchd/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
NPM_PATH="$(command -v npm || true)"

if [ -z "$NPM_PATH" ]; then
  echo "npm not found on PATH - install Node.js first (see README.md)." >&2
  exit 1
fi

if [ ! -x "$REPO_ROOT/backend/venv/bin/python" ]; then
  echo "backend/venv not found - run the backend setup steps in README.md first." >&2
  exit 1
fi

CADDY_PATH="$(command -v caddy || true)"
if [ -z "$CADDY_PATH" ]; then
  echo "caddy not found on PATH - run 'brew install caddy' first." >&2
  exit 1
fi

# launchd can't open StandardOutPath/StandardErrorPath on this repo's volume
# (external drive mounted with `noowners`, which blocks the file-ownership
# step launchd does when creating a log file - jobs fail instantly with
# EX_CONFIG (78) if logs point there). Logs go on the internal disk instead;
# everything else (executables, working directory) is unaffected and can
# stay on the external volume.
LOG_DIR="$HOME/Library/Logs/ragchatbot"

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

for name in backend frontend caddy; do
  src="$SCRIPT_DIR/com.ragchatbot.$name.plist"
  dest="$LAUNCH_AGENTS_DIR/com.ragchatbot.$name.plist"
  sed -e "s|__REPO_ROOT__|$REPO_ROOT|g" -e "s|__NPM_PATH__|$NPM_PATH|g" -e "s|__CADDY_PATH__|$CADDY_PATH|g" -e "s|__HOME__|$HOME|g" -e "s|__LOG_DIR__|$LOG_DIR|g" "$src" > "$dest"

  # Reload cleanly if already installed
  launchctl unload "$dest" 2>/dev/null || true
  launchctl load -w "$dest"
  echo "✓ Installed and started com.ragchatbot.$name"
done

echo
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:3000"
echo
echo "Logs: $LOG_DIR/{backend,frontend,caddy}.{out,err}.log"
echo "Uninstall: ./deploy/launchd/uninstall.sh"
