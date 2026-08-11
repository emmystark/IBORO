#!/bin/bash
# One-shot (and idempotent - safe to re-run) setup for a new machine.
# Installs everything this app needs (Homebrew, Python, Node, Ollama,
# Caddy), pulls the AI model, configures the app, registers it to
# auto-start, and opens it in the browser. A client should never need to
# open a terminal or an editor - "Start Iboro.command" runs this.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODEL="qwen2.5:3b-instruct-q4_K_M"

say() { printf "\n\033[1;34m▶ %s\033[0m\n" "$1"; }
ok()  { printf "  \033[0;32m✓\033[0m %s\n" "$1"; }

echo "=========================================="
echo "  Iboro - first-run setup"
echo "=========================================="
echo "This installs everything needed to run the app on this Mac."
echo "You'll be asked for your Mac password once, by Homebrew - that's normal."

# ── Homebrew ────────────────────────────────────────────────────────────
say "Checking Homebrew"
if ! command -v brew &>/dev/null; then
  echo "  Installing Homebrew (you'll be prompted for your password)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi
  if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
else
  ok "Homebrew already installed"
fi
BREW_PREFIX="$(brew --prefix)"

# ── System dependencies ────────────────────────────────────────────────
say "Checking system dependencies (Python, Node, Ollama, Caddy)"
for formula in python@3.12 node ollama caddy; do
  if brew list --versions "$formula" &>/dev/null; then
    ok "$formula already installed"
  else
    echo "  Installing $formula..."
    brew install "$formula"
  fi
done

# ── Ollama service + model ─────────────────────────────────────────────
say "Starting Ollama"
if curl -s -o /dev/null http://localhost:11434; then
  ok "Ollama already running (e.g. the Ollama.app menu-bar app) - leaving it as-is"
else
  brew services start ollama &>/dev/null || true
  for i in $(seq 1 30); do
    curl -s -o /dev/null http://localhost:11434 && break
    sleep 1
  done
fi
if ! curl -s -o /dev/null http://localhost:11434; then
  echo "  Ollama didn't come up - is it installed correctly? Try 'brew services restart ollama' in Terminal." >&2
  exit 1
fi
ok "Ollama running"

say "Downloading the AI model ($MODEL) - this is the slow part on a first run (~2GB)"
if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
  ok "Model already downloaded"
else
  ollama pull "$MODEL"
fi

# ── License check ───────────────────────────────────────────────────────
# Fail loudly here, before anything else - if this is skipped, the backend
# still refuses to start (see backend/license_guard.py), but silently, as
# a background service the "waiting for it to start" loop below would just
# time out on with no explanation. This is the one thing packaging a copy
# for a customer must not forget: run deploy/license/issue_license.py for
# them and place the result at backend/license.json before handing it off.
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
PYTHON_BIN="$BREW_PREFIX/opt/python@3.12/bin/python3.12"
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
LICENSE_SERVER_URL=
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
# Without this, the very first launch would lock out the person running
# setup - the gateway blocks unlisted IPs by default (see Network Access
# tab). Tailscale's range is always trusted regardless.
say "Configuring network access"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"
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
bash "$SCRIPT_DIR/launchd/install.sh"

# ── Wait for it to come up, then open it ────────────────────────────────
say "Waiting for the app to start"
BACKEND_LOG="$HOME/Library/Logs/ragchatbot/backend.out.log"
STARTED=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8000 && curl -sk -o /dev/null https://localhost:8443; then
    STARTED=1
    break
  fi
  sleep 1
done

if [ "$STARTED" != "1" ]; then
  echo
  echo "=========================================="
  echo "  The app didn't start"
  echo "=========================================="
  if [ -f "$BACKEND_LOG" ] && grep -q "LICENSE ERROR" "$BACKEND_LOG"; then
    echo "  A license problem is blocking it - here's the detail:"
    echo
    grep -A 5 "LICENSE ERROR" "$BACKEND_LOG" | tail -8
  else
    echo "  Check the logs for details: $HOME/Library/Logs/ragchatbot/"
  fi
  echo "=========================================="
  exit 1
fi

# The gateway serves HTTPS with a certificate from Caddy's own local CA
# (no public domain or internet dependency - see backend/app.py's
# _render_caddyfile). `caddy trust` installs that CA into this machine's
# system trust store so its own browser shows a clean padlock instead of a
# warning. Other devices still see a one-time warning the first time they
# open the link unless that CA is installed on them too (see GUIDE.md).
say "Trusting this machine's local HTTPS certificate"
if caddy trust 2>&1 | tee /tmp/caddy-trust.log | grep -qi "error"; then
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
echo "  This machine will keep serving the app in the background from now"
echo "  on, even after you close this window - see the included GUIDE.md"
echo "  for how to let coworkers and remote devices connect."
echo "=========================================="
open "$GATEWAY_URL" 2>/dev/null || true
