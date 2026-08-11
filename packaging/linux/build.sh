#!/bin/bash
# Builds a single self-extracting Iboro-Install.run file for Linux - one
# file to share, no folders to navigate. Unlike the Windows .exe, this can
# genuinely be built (and was tested) from macOS, since it's just a shell
# script with a tar.gz payload appended - no cross-compilation involved.
#
# Usage on the recipient's Linux machine:
#   chmod +x Iboro-Install.run
#   ./Iboro-Install.run
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST="$SCRIPT_DIR/dist"
VARIANT="${1:-thin}"   # thin | full
OLLAMA_MODELS_SRC="${OLLAMA_MODELS_SRC:-$HOME/.ollama/models}"

if [ ! -f "$REPO_ROOT/backend/license.json" ]; then
  echo "⚠️  No backend/license.json found - this build will have no license and won't start." >&2
  echo "   Run deploy/license/issue_license.py for the target company first." >&2
fi

rm -rf "$DIST"
mkdir -p "$DIST"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "▶ Staging app source ($VARIANT variant)"
mkdir -p "$STAGE/app"
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
  "$REPO_ROOT/" "$STAGE/app/"

if [ "$VARIANT" = "full" ]; then
  echo "▶ Bundling the AI model (~2GB, this is the slow part)"
  mkdir -p "$STAGE/model/manifests/registry.ollama.ai/library/qwen2.5" "$STAGE/model/blobs"
  cp "$OLLAMA_MODELS_SRC/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M" \
    "$STAGE/model/manifests/registry.ollama.ai/library/qwen2.5/"
  python3 -c "
import json, shutil
manifest = json.load(open('$OLLAMA_MODELS_SRC/manifests/registry.ollama.ai/library/qwen2.5/3b-instruct-q4_K_M'))
digests = [manifest['config']['digest']] + [l['digest'] for l in manifest['layers']]
for d in digests:
    name = d.replace(':', '-')
    shutil.copy('$OLLAMA_MODELS_SRC/blobs/' + name, '$STAGE/model/blobs/' + name)
    print('  copied', name)
"
fi

cp "$SCRIPT_DIR/run.sh" "$STAGE/run.sh"
chmod +x "$STAGE/run.sh"

echo "▶ Packing into a single self-extracting file"
OUT="$DIST/Iboro-Install-$VARIANT.run"

cat > "$OUT" <<'STUB'
#!/bin/bash
# Self-extracting Iboro installer. Everything below the marker line is a
# tar.gz payload - this header just extracts it to a temp dir and runs it.
set -euo pipefail
MARKER=$(grep -an '^__PAYLOAD_BELOW__' "$0" | head -1 | cut -d: -f1)
PAYLOAD_START=$((MARKER + 1))
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
tail -n +"$PAYLOAD_START" "$0" | tar -xz -C "$WORKDIR"
exec bash "$WORKDIR/run.sh" "$WORKDIR"
__PAYLOAD_BELOW__
STUB

(cd "$STAGE" && tar -czf - .) >> "$OUT"
chmod +x "$OUT"

echo
echo "=========================================="
echo "  Done"
echo "=========================================="
echo "  $OUT"
du -h "$OUT"
echo "=========================================="
