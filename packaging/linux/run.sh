#!/bin/bash
# Runs after the self-extracting .run file unpacks itself to a temp dir
# (see build.sh's stub header). Copies into a persistent install location
# the first time, seeds the bundled model if present, then runs setup -
# same pattern as packaging/macos/run.sh, see that file for the reasoning.
set -euo pipefail

EXTRACTED_DIR="$1"
INSTALL_DIR="$HOME/.local/share/iboro"

echo "=========================================="
echo "  Iboro"
echo "=========================================="

if [ ! -d "$INSTALL_DIR/app" ]; then
  echo "First launch - installing to $INSTALL_DIR ..."
  mkdir -p "$INSTALL_DIR"
  cp -R "$EXTRACTED_DIR/app" "$INSTALL_DIR/app"
else
  echo "Already installed - checking everything's up to date..."
fi

if [ -d "$EXTRACTED_DIR/model" ]; then
  OLLAMA_MODELS_DIR="$HOME/.ollama/models"
  MARKER="$INSTALL_DIR/.model-seeded"
  if [ ! -f "$MARKER" ]; then
    echo "Installing the bundled AI model (no download needed)..."
    mkdir -p "$OLLAMA_MODELS_DIR/manifests/registry.ollama.ai/library/qwen2.5" "$OLLAMA_MODELS_DIR/blobs"
    cp -n "$EXTRACTED_DIR/model/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M" \
      "$OLLAMA_MODELS_DIR/manifests/registry.ollama.ai/library/qwen2.5/" 2>/dev/null || true
    cp -n "$EXTRACTED_DIR/model/blobs/"* "$OLLAMA_MODELS_DIR/blobs/" 2>/dev/null || true
    touch "$MARKER"
  fi
fi

bash "$INSTALL_DIR/app/deploy/linux/setup.sh"

echo
echo "Done - you can close this terminal."
read -r -p "Press Enter to close..."
