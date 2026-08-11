# Runs when Iboro is launched (Start Menu / Desktop shortcut created by
# the installer). Copies the installed app into a writable working copy
# the first time (installer's {app}\app is treated as the source), seeds
# the bundled model if present, then runs setup - same pattern as
# packaging/macos/run.sh, see that file for the full reasoning.
param(
    [Parameter(Mandatory=$true)][string]$InstallRoot
)

$ErrorActionPreference = "Stop"
$WorkDir = "$env:LOCALAPPDATA\Iboro"

Write-Host "=========================================="
Write-Host "  Iboro"
Write-Host "=========================================="

if (-not (Test-Path "$WorkDir\app")) {
    Write-Host "First launch - installing to $WorkDir ..."
    New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
    Copy-Item -Path "$InstallRoot\app" -Destination "$WorkDir\app" -Recurse
} else {
    Write-Host "Already installed - checking everything's up to date..."
}

$ModelSrc = "$InstallRoot\model"
if (Test-Path $ModelSrc) {
    $Marker = "$WorkDir\.model-seeded"
    if (-not (Test-Path $Marker)) {
        Write-Host "Installing the bundled AI model (no download needed)..."
        $OllamaModels = "$env:USERPROFILE\.ollama\models"
        New-Item -ItemType Directory -Force -Path "$OllamaModels\manifests\registry.ollama.ai\library\qwen2.5" | Out-Null
        New-Item -ItemType Directory -Force -Path "$OllamaModels\blobs" | Out-Null
        Copy-Item "$ModelSrc\manifests\registry.ollama.ai\library\qwen2.5\3b-instruct-q4_K_M" `
            "$OllamaModels\manifests\registry.ollama.ai\library\qwen2.5\" -Force
        Copy-Item "$ModelSrc\blobs\*" "$OllamaModels\blobs\" -Force
        New-Item -ItemType File -Force -Path $Marker | Out-Null
    }
}

powershell -ExecutionPolicy Bypass -File "$WorkDir\app\deploy\windows\setup.ps1"

Write-Host ""
Write-Host "Done - you can close this window."
Read-Host "Press Enter to close"
