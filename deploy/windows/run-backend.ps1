# Runs the backend in a loop, restarting it if it exits. Task Scheduler's
# own "restart on failure" only retries a handful of times, not
# indefinitely like launchd/systemd do, so this wrapper is what the
# scheduled task actually points at.
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location "$RepoRoot\backend"
while ($true) {
    & "$RepoRoot\backend\venv\Scripts\python.exe" app.py
    Start-Sleep -Seconds 3
}
