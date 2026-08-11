# Stops and removes the auto-start scheduled tasks installed by
# install-services.ps1. Nothing about the app itself is deleted.
$ErrorActionPreference = "SilentlyContinue"

foreach ($name in @("KnowledgeBase-Backend", "KnowledgeBase-Frontend", "KnowledgeBase-Caddy")) {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName $name
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "Removed $name"
    } else {
        Write-Host "$name was not installed"
    }
}

# Stopping the scheduled task only kills the top-level powershell.exe
# wrapper, not the app process (python/node/caddy) it launched - find and
# stop those directly by matching on command line.
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match "run-backend\.ps1|run-frontend\.ps1|run-caddy\.ps1" -or
    $_.CommandLine -match "backend\\venv\\Scripts\\python\.exe app\.py" -or
    $_.CommandLine -match "deploy\\caddy\\Caddyfile"
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# npm run dev spawns a node child that the above won't catch directly -
# stop any node process whose parent chain led here isn't trivial to
# trace, so just stop node processes started from the frontend directory.
Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq "node.exe" -and $_.CommandLine -match "next"
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
