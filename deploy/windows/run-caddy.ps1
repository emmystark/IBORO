# Runs the Caddy gateway in a loop, restarting it if it exits. See
# run-backend.ps1 for why this wrapper exists.
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
while ($true) {
    & caddy run --config "$RepoRoot\deploy\caddy\Caddyfile"
    Start-Sleep -Seconds 3
}
