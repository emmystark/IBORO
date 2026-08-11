#!/bin/bash
# One-shot (and idempotent - safe to re-run) setup for a new Linux machine.
# Installs everything this app needs (Python, Node, Ollama, Caddy), pulls
# the AI model, configures the app, registers it to auto-start via
# systemd --user, and opens it in the browser. Mirrors deploy/setup.sh
# (the macOS version) - see that file for the design notes behind each step.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODEL="qwen2.5:3b-instruct-q4_K_M"

say() { printf "\n\033[1;34m> %s\033[0m\n" "$1"; }
ok()  { printf "  \033[0;32mOK\033[0m %s\n" "$1"; }

echo "=========================================="
echo "  Iboro - first-run setup (Linux)"
echo "=========================================="
echo "This installs everything needed to run the app on this machine."
echo "You'll be asked for your sudo password for system package installs."

# ── Package manager detection ───────────────────────────────────────────
if command -v apt-get &>/dev/null; then
  PKG_INSTALL="sudo apt-get install -y"
  PKG_UPDATE="sudo apt-get update"
  PYTHON_PKGS="python3 python3-venv python3-pip"
  NODE_PKGS="nodejs npm"
elif command -v dnf &>/dev/null; then
  PKG_INSTALL="sudo dnf install -y"
  PKG_UPDATE="sudo dnf check-update || true"
  PYTHON_PKGS="python3 python3-pip"
  NODE_PKGS="nodejs npm"
else
  echo "No supported package manager found (need apt or dnf). Install Python 3.10+, Node 18+, Ollama, and Caddy manually, then re-run this script." >&2
  exit 1
fi

say "Updating package lists"
eval "$PKG_UPDATE"

say "Checking system dependencies (Python, Node)"
eval "$PKG_INSTALL $PYTHON_PKGS $NODE_PKGS curl"
ok "Python and Node installed"

PYTHON_BIN="$(command -v python3)"
"$PYTHON_BIN" -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ required"' || {
  echo "Python 3.10+ is required - your distro's python3 is too old. Install a newer one (e.g. via deadsnakes PPA on Ubuntu) and re-run." >&2
  exit 1
}

# ── Ollama ──────────────────────────────────────────────────────────────
say "Checking Ollama"
if command -v ollama &>/dev/null; then
  ok "Ollama already installed"
else
  echo "  Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi
# The official installer sets up its own systemd service and starts it.
for i in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:11434 && break
  sleep 1
done
ok "Ollama running"

say "Downloading the AI model ($MODEL) - this is the slow part on a first run (~2GB)"
if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
  ok "Model already downloaded"
else
  ollama pull "$MODEL"
fi

# ── Caddy ───────────────────────────────────────────────────────────────
say "Checking Caddy"
if command -v caddy &>/dev/null; then
  ok "Caddy already installed"
else
  echo "  Installing Caddy..."
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) CADDY_ARCH="amd64" ;;
    aarch64|arm64) CADDY_ARCH="arm64" ;;
    *) echo "Unsupported architecture for Caddy: $ARCH" >&2; exit 1 ;;
  esac
  curl -sSL "https://caddyserver.com/api/download?os=linux&arch=${CADDY_ARCH}" -o /tmp/caddy
  chmod +x /tmp/caddy
  sudo install -m 755 /tmp/caddy /usr/local/bin/caddy
  rm -f /tmp/caddy
fi
ok "Caddy installed"

# ── License check ───────────────────────────────────────────────────────
# Fail loudly here, before anything else - see the matching comment in
# deploy/setup.sh (the macOS version) for the full reasoning.
if [ ! -f "$REPO_ROOT/backend/license.json" ]; then
  echo
  echo "=========================================="
  echo "  Missing backend/license.json"
  echo "=========================================="
  echo "  This copy of the app has no license installed and cannot start."
  echo "  See deploy/license/README.md for how to issue one."
  echo "=========================================="
  exit 1
fi

# ── Backend ─────────────────────────────────────────────────────────────
say "Setting up the backend"
cd "$REPO_ROOT/backend"
if [ ! -x "venv/bin/python" ]; then
  "$PYTHON_BIN" -m venv venv
fi
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt
ok "Backend dependencies installed"

if [ ! -f .env ]; then
  echo
  echo "  First-time setup: choose a password for the admin account."
  read -r -s -p "  Admin password: " ADMIN_PW
  echo
  while [ -z "$ADMIN_PW" ]; do
    read -r -s -p "  Password can't be empty - try again: " ADMIN_PW
    echo
  done
  SECRET_KEY="$("$PYTHON_BIN" -c 'import secrets; print(secrets.token_urlsafe(32))')"
  cat > .env <<EOF
SECRET_KEY=$SECRET_KEY
ADMIN_DEFAULT_PASSWORD=$ADMIN_PW
OLLAMA_MODEL=$MODEL
OLLAMA_URL=http://localhost:11434
ALLOWED_ORIGINS=http://localhost:3000
CADDY_CONFIG_PATH=../deploy/caddy/Caddyfile
CADDY_ADMIN_URL=http://localhost:2019
EOF
  ok "Created backend/.env (admin username: admin)"
else
  ok "backend/.env already exists, leaving it as-is"
fi

# ── Frontend ────────────────────────────────────────────────────────────
say "Setting up the frontend"
cd "$REPO_ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install --no-fund --no-audit
else
  ok "Frontend dependencies already installed"
fi
if [ ! -f .env.local ]; then
  echo "NEXT_PUBLIC_API_URL=" > .env.local
fi

# ── Seed the gateway allowlist with this machine's own address ─────────
say "Configuring network access"
LAN_IP="$("$PYTHON_BIN" -c 'import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("8.8.8.8", 80)); print(s.getsockname()[0]); s.close()' 2>/dev/null || echo "")"
NETWORK_ACCESS_FILE="$REPO_ROOT/backend/network_access.json"
if [ ! -f "$NETWORK_ACCESS_FILE" ] && [ -n "$LAN_IP" ]; then
  ENTRY_ID="$("$PYTHON_BIN" -c 'import uuid; print(uuid.uuid4())')"
  NOW="$("$PYTHON_BIN" -c 'from datetime import datetime; print(datetime.utcnow().isoformat()+"Z")')"
  cat > "$NETWORK_ACCESS_FILE" <<EOF
{
  "$ENTRY_ID": {
    "id": "$ENTRY_ID",
    "ip": "$LAN_IP",
    "label": "This computer",
    "created_at": "$NOW"
  }
}
EOF
  ok "Trusted this computer's address ($LAN_IP) - add more from the admin dashboard's Network Access tab"
else
  ok "Network access list already configured"
fi

# ── Register auto-start services ────────────────────────────────────────
say "Registering background services (auto-start on login)"
bash "$SCRIPT_DIR/install-services.sh"

# ── Wait for it to come up, then open it ────────────────────────────────
say "Waiting for the app to start"
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8000 && curl -sk -o /dev/null https://localhost:8443; then
    break
  fi
  sleep 1
done

# The gateway serves HTTPS with a certificate from Caddy's own local CA
# (no public domain or internet dependency). `caddy trust` installs that
# CA into this machine's system trust store so its own browser shows a
# clean padlock instead of a warning. Other devices still see a one-time
# warning the first time they open the link unless that CA is installed
# on them too - see GUIDE.md.
say "Trusting this machine's local HTTPS certificate"
if caddy trust 2>&1 | grep -qi "error"; then
  echo "  Could not install the certificate automatically - you may see a browser warning on this machine too. Try 'sudo caddy trust' manually."
else
  ok "This machine will show a clean padlock, no warning"
fi

GATEWAY_URL="https://${LAN_IP:-localhost}:8443"
echo
echo "=========================================="
echo "  Setup complete"
echo "=========================================="
echo "  App URL:        $GATEWAY_URL"
echo "  Admin username: admin"
echo "  (Password is whatever you just set above)"
echo
echo "  See GUIDE.md for how to let coworkers and remote devices connect."
echo "=========================================="
xdg-open "$GATEWAY_URL" 2>/dev/null || echo "  Open $GATEWAY_URL in your browser."
