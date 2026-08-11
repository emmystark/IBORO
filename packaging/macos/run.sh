#!/bin/bash
# Runs inside Terminal when Iboro.app is double-clicked. Copies the app
# out of the (read-only, inside-the-bundle) Resources folder into a real
# writable install location the first time, then runs normal setup from
# there. Every launch after the first just starts/opens the already-set-up
# app - this script itself is invisible to the user, they only ever see
# the Terminal window's progress text.
set -euo pipefail

APP_RESOURCES="$1"
VARIANT="$2"
INSTALL_DIR="$HOME/Library/Application Support/Iboro"

echo "=========================================="
echo "  Iboro"
echo "=========================================="

if [ ! -d "$INSTALL_DIR/app" ]; then
  echo "First launch - installing to $INSTALL_DIR ..."
  mkdir -p "$INSTALL_DIR"
  cp -R "$APP_RESOURCES/app" "$INSTALL_DIR/app"
else
  echo "Already installed - checking everything's up to date..."
fi

if [ "$VARIANT" = "full" ] && [ -d "$APP_RESOURCES/model" ]; then
  OLLAMA_MODELS_DIR="$HOME/.ollama/models"
  MARKER="$INSTALL_DIR/.model-seeded"
  if [ ! -f "$MARKER" ]; then
    echo "Installing the bundled AI model (no download needed)..."
    mkdir -p "$OLLAMA_MODELS_DIR/manifests/registry.ollama.ai/library/qwen2.5" "$OLLAMA_MODELS_DIR/blobs"
    cp -n "$APP_RESOURCES/model/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M" \
      "$OLLAMA_MODELS_DIR/manifests/registry.ollama.ai/library/qwen2.5/" 2>/dev/null || true
    cp -n "$APP_RESOURCES/model/blobs/"* "$OLLAMA_MODELS_DIR/blobs/" 2>/dev/null || true
    touch "$MARKER"
  fi
fi

bash "$INSTALL_DIR/app/deploy/setup.sh"

echo
echo "Done - you can close this window."
read -r -p "Press Enter to close..."
