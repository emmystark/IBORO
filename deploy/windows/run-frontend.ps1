# Runs the frontend in a loop, restarting it if it exits. See
# run-backend.ps1 for why this wrapper exists.
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location "$RepoRoot\frontend"
while ($true) {
    & npm run dev
    Start-Sleep -Seconds 3
}
