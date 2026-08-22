# Registers Task Scheduler tasks so the backend, frontend, and Caddy
# gateway start automatically at login and restart automatically if they
# crash (each points at its own run-*.ps1 wrapper, which loops).
$ErrorActionPreference = "Stop"

$npmPath = (Get-Command npm -ErrorAction SilentlyContinue).Source
$caddyPath = (Get-Command caddy -ErrorAction SilentlyContinue).Source
if (-not $npmPath) { Write-Error "npm not found on PATH - run deploy\windows\setup.ps1 first."; exit 1 }
if (-not $caddyPath) { Write-Error "caddy not found on PATH - run deploy\windows\setup.ps1 first."; exit 1 }

function Install-Task($name, $scriptPath) {
    $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
    }
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    # S4U (not the default Interactive logon type) runs the task detached from
    # the interactive session's console - without this, an RDP disconnect
    # sends a console control signal that kills every task tied to that
    # session (exit code 0xC000013A / "control-C exit"), which is exactly
    # what happens on an EC2 Windows box managed entirely over RDP.
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Iboro - $name" | Out-Null
    Start-ScheduledTask -TaskName $name
    Write-Host "Installed and started $name"
}

Install-Task "KnowledgeBase-Backend" "$PSScriptRoot\run-backend.ps1"
Install-Task "KnowledgeBase-Frontend" "$PSScriptRoot\run-frontend.ps1"
Install-Task "KnowledgeBase-Caddy" "$PSScriptRoot\run-caddy.ps1"

Write-Host ""
Write-Host "Uninstall: deploy\windows\uninstall-services.ps1"
