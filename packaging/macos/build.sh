#!/bin/bash
# Builds a real double-clickable Iboro.app for macOS - no visible folders,
# no terminal navigation, just one icon in Finder. Produces two variants:
#
#   Iboro (Thin).app  - small (~50MB), downloads the AI model on first
#                        run (needs internet once, same as tonight's
#                        deploy/setup.sh, just wrapped as a real app).
#   Iboro (Full).app   - large (~2GB), the AI model is bundled inside the
#                        app itself so first run needs no internet at all.
#
# Run this ON A MAC (it copies files with macOS-specific tools). Output
# goes to packaging/macos/dist/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST="$SCRIPT_DIR/dist"
MODEL="qwen2.5:3b-instruct-q4_K_M"
OLLAMA_MODELS_SRC="${OLLAMA_MODELS_SRC:-$HOME/.ollama/models}"

rm -rf "$DIST"
mkdir -p "$DIST"

build_app() {
  local variant="$1"       # "thin" or "full"
  local app_name="$2"      # e.g. "Iboro (Thin).app"
  local app_path="$DIST/$app_name"

  echo "▶ Building $app_name"
  mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"

  cat > "$app_path/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Iboro</string>
    <key>CFBundleDisplayName</key>
    <string>Iboro</string>
    <key>CFBundleIdentifier</key>
    <string>com.iboro.app</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>launch</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

  # The repo lives inside the bundle's Resources - a user only ever sees
  # the single "Iboro.app" icon in Finder; everything under Contents/ is
  # invisible unless they deliberately right-click -> Show Package Contents.
  echo "  Copying app source into bundle (this takes a moment)..."
  mkdir -p "$app_path/Contents/Resources/app"
  # Everything below is either huge (node_modules, venv, models) or, more
  # importantly, THIS machine's own runtime/demo state - .env (secrets),
  # users/conversations/departments (demo data), network_access.json (this
  # machine's trusted IPs), and critically .license_activation.json (which
  # would falsely make the packaged app think it's already activated on
  # THIS dev machine, locking out the actual customer machine it's meant
  # for). backend/license.json is INTENTIONALLY not excluded - replace it
  # with the real customer's license before running this build.
  rsync -a \
    --exclude 'node_modules' --exclude '.next' --exclude 'venv' \
    --exclude 'chroma_db*' --exclude 'data' --exclude '.git' \
    --exclude 'packaging' --exclude '*.log' \
    --exclude 'backend/.env' \
    --exclude 'backend/users.json' --exclude 'backend/conversations.json' \
    --exclude 'backend/organizations.json' --exclude 'backend/departments.json' \
    --exclude 'backend/network_access.json' --exclude 'backend/roles.json' \
    --exclude 'backend/.license_activation.json' \
    --exclude 'backend/app.db' --exclude 'backend/app.db-wal' --exclude 'backend/app.db-shm' \
    --exclude 'backend/*-.json' --exclude 'backend/*--.json' \
    --exclude 'frontend/.env.local' --exclude 'frontend/.env.production' \
    "$REPO_ROOT/" "$app_path/Contents/Resources/app/"

  if [ ! -f "$REPO_ROOT/backend/license.json" ]; then
    echo "  ⚠️  No backend/license.json found - this build will have no license and won't start." >&2
    echo "     Run deploy/license/issue_license.py for the target company first." >&2
  fi

  if [ "$variant" = "full" ]; then
    echo "  Bundling the AI model (~2GB, this is the slow part)..."
    mkdir -p "$app_path/Contents/Resources/model/manifests/registry.ollama.ai/library/qwen2.5" \
             "$app_path/Contents/Resources/model/blobs"
    cp "$OLLAMA_MODELS_SRC/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M" \
      "$app_path/Contents/Resources/model/manifests/registry.ollama.ai/library/qwen2.5/"
    # Only the blobs this exact model's manifest references - not the
    # whole (possibly many-GB) local Ollama library.
    python3 -c "
import json, shutil, sys
manifest = json.load(open('$OLLAMA_MODELS_SRC/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M'))
digests = [manifest['config']['digest']] + [l['digest'] for l in manifest['layers']]
for d in digests:
    name = d.replace(':', '-')
    shutil.copy('$OLLAMA_MODELS_SRC/blobs/' + name, '$app_path/Contents/Resources/model/blobs/' + name)
    print('  copied', name)
"
  fi

  cat > "$app_path/Contents/MacOS/launch" <<LAUNCH
#!/bin/bash
# Runs when the .app is double-clicked. Opens Terminal so the user can see
# setup/start progress (first run installs things and can take a while;
# every run after is a few seconds) - a silent background launch would
# look frozen with no feedback.
APP_RESOURCES="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")/../Resources" && pwd)"
VARIANT="$variant"
osascript <<OSA
tell application "Terminal"
    activate
    do script "\\"\$APP_RESOURCES/run.sh\\" \\"\$APP_RESOURCES\\" \\"\$VARIANT\\""
end tell
OSA
LAUNCH
  chmod +x "$app_path/Contents/MacOS/launch"

  cp "$SCRIPT_DIR/run.sh" "$app_path/Contents/Resources/run.sh"
  chmod +x "$app_path/Contents/Resources/run.sh"

  echo "  ✓ $app_name built"
}

build_app thin "Iboro (Thin).app"
build_app full "Iboro (Full).app"

echo
echo "=========================================="
echo "  Done"
echo "=========================================="
echo "  packaging/macos/dist/Iboro (Thin).app  - share this normally; first run needs internet to download the AI model (~2GB)"
echo "  packaging/macos/dist/Iboro (Full).app  - larger file, but works with zero internet from the first launch"
echo "=========================================="
