#!/bin/bash
# Installs systemd --user services so the backend, frontend, and Caddy
# gateway start automatically on login (and after a reboot, once lingering
# is enabled below) and restart automatically if they crash.
#
# Usage: ./deploy/linux/install-services.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UNIT_DIR="$HOME/.config/systemd/user"
NPM_PATH="$(command -v npm || true)"
CADDY_PATH="$(command -v caddy || true)"

if [ -z "$NPM_PATH" ]; then
  echo "npm not found on PATH - run deploy/linux/setup.sh first." >&2
  exit 1
fi
if [ -z "$CADDY_PATH" ]; then
  echo "caddy not found on PATH - run deploy/linux/setup.sh first." >&2
  exit 1
fi
if [ ! -x "$REPO_ROOT/backend/venv/bin/python" ]; then
  echo "backend/venv not found - run deploy/linux/setup.sh first." >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"

for name in backend frontend caddy; do
  src="$SCRIPT_DIR/ragchatbot-$name.service"
  dest="$UNIT_DIR/ragchatbot-$name.service"
  sed -e "s|__REPO_ROOT__|$REPO_ROOT|g" -e "s|__NPM_PATH__|$NPM_PATH|g" -e "s|__CADDY_PATH__|$CADDY_PATH|g" "$src" > "$dest"
done

systemctl --user daemon-reload
for name in backend frontend caddy; do
  systemctl --user enable --now "ragchatbot-$name.service"
  echo "Installed and started ragchatbot-$name"
done

# Without this, user services stop the moment you log out - lingering
# keeps them running (and starts them on boot) even with no active session.
if command -v loginctl &>/dev/null; then
  loginctl enable-linger "$USER" 2>/dev/null || true
fi

echo
echo "Logs: journalctl --user -u ragchatbot-backend -f  (swap the unit name for frontend/caddy)"
echo "Uninstall: ./deploy/linux/uninstall-services.sh"
