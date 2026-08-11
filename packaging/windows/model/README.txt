To build the "Full" (fully offline) Windows installer, populate this
folder with the AI model files BEFORE running ISCC.exe, then compile
WITHOUT the /DTHIN=1 flag.

On a Windows machine that already has Ollama with the model pulled
(ollama pull qwen2.5:3b-instruct-q4_K_M), copy these two paths from
%USERPROFILE%\.ollama\models\ into this folder, keeping the same
structure:

  model\manifests\registry.ollama.ai\library\qwen2.5\3b-instruct-q4_K_M
  model\blobs\sha256-<the 4 digests listed in that manifest file>

The manifest file (a small JSON file, no extension) lists exactly which
blob files it needs under "config" and "layers" - copy only those, not
your whole blobs folder, or you'll bundle every model you've ever
downloaded.

If you don't want to figure that out by hand, run this from PowerShell
inside the model\ folder (adjust the path to your real Ollama models dir):

  $src = "$env:USERPROFILE\.ollama\models"
  $manifest = Get-Content "$src\manifests\registry.ollama.ai\library\qwen2.5\3b-instruct-q4_K_M" | ConvertFrom-Json
  New-Item -ItemType Directory -Force -Path "manifests\registry.ollama.ai\library\qwen2.5", "blobs" | Out-Null
  Copy-Item "$src\manifests\registry.ollama.ai\library\qwen2.5\3b-instruct-q4_K_M" "manifests\registry.ollama.ai\library\qwen2.5\"
  $digests = @($manifest.config.digest) + ($manifest.layers | ForEach-Object { $_.digest })
  foreach ($d in $digests) {
      $name = $d -replace ':', '-'
      Copy-Item "$src\blobs\$name" "blobs\$name"
  }

Leave this folder empty (just this README) to build the Thin variant
instead - pass /DTHIN=1 to ISCC.exe and the installer just won't include
the [Files] entries that reference this folder.
