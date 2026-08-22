# One-shot (and idempotent - safe to re-run) setup for a new Windows
# machine. Installs everything this app needs (Python, Node, Ollama,
# Caddy), pulls the AI model, configures the app, registers it to
# auto-start via Task Scheduler, and opens it in the browser. Mirrors
# deploy/setup.sh (the macOS version) - see that file for the design
# notes behind each step.

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$Model = "qwen2.5:3b-instruct-q4_K_M"

function Say($msg)  { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  OK $msg" -ForegroundColor Green }

Write-Host "=========================================="
Write-Host "  Iboro - first-run setup (Windows)"
Write-Host "=========================================="
Write-Host "This installs everything needed to run the app on this PC."
Write-Host "Windows may ask you to confirm installer prompts - that's normal."

# ── winget check ────────────────────────────────────────────────────────
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget is required (comes with Windows 11 and modern Windows 10 via the App Installer from the Microsoft Store). Install 'App Installer' from the Store, then re-run this script."
    exit 1
}

# ── System dependencies ────────────────────────────────────────────────
Say "Checking system dependencies (Python, Node, Ollama, Caddy)"

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Install-IfMissing($command, $wingetId, $label) {
    Refresh-Path
    if (Get-Command $command -ErrorAction SilentlyContinue) {
        Ok "$label already installed"
        return
    }
    Write-Host "  Installing $label..."
    winget install --id $wingetId --source winget --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        Write-Error "$label still isn't available after winget install (exit code $LASTEXITCODE). See the output above for details."
        exit 1
    }
    Ok "$label installed"
}

Install-IfMissing "python" "Python.Python.3.12" "Python"
Install-IfMissing "node" "OpenJS.NodeJS.LTS" "Node.js"
Install-IfMissing "ollama" "Ollama.Ollama" "Ollama"
Install-IfMissing "caddy" "CaddyServer.Caddy" "Caddy"

# Refresh PATH in this session - winget-installed tools won't be visible
# to the current process until this.
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# ── Ollama ──────────────────────────────────────────────────────────────
Say "Starting Ollama"
try {
    Invoke-WebRequest -Uri "http://localhost:11434" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Ok "Ollama already running"
} catch {
    Start-Process -WindowStyle Hidden -FilePath "ollama" -ArgumentList "serve"
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            Invoke-WebRequest -Uri "http://localhost:11434" -UseBasicParsing -TimeoutSec 2 | Out-Null
            break
        } catch {}
    }
    Ok "Ollama running"
}

Say "Downloading the AI model ($Model) - this is the slow part on a first run (~2GB)"
$models = & ollama list
if ($models -match [regex]::Escape($Model)) {
    Ok "Model already downloaded"
} else {
    & ollama pull $Model
}

# ── License check ───────────────────────────────────────────────────────
# Fail loudly here, before anything else - see the matching comment in
# deploy/setup.sh (the macOS version) for the full reasoning.
if (-not (Test-Path "$RepoRoot\backend\license.json")) {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  Missing backend\license.json"
    Write-Host "=========================================="
    Write-Host "  This copy of the app has no license installed and cannot start."
    Write-Host "  See deploy\license\README.md for how to issue one."
    Write-Host "=========================================="
    exit 1
}

# ── Backend ─────────────────────────────────────────────────────────────
Say "Setting up the backend"
Set-Location "$RepoRoot\backend"
if (-not (Test-Path "venv\Scripts\python.exe")) {
    python -m venv venv
}
& venv\Scripts\pip.exe install -q --upgrade pip
& venv\Scripts\pip.exe install -q -r requirements.txt
Ok "Backend dependencies installed"

if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "  First-time setup: choose a password for the admin account."
    $securePw = Read-Host "  Admin password" -AsSecureString
    $adminPw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw))
    while ([string]::IsNullOrEmpty($adminPw)) {
        $securePw = Read-Host "  Password can't be empty - try again" -AsSecureString
        $adminPw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw))
    }
    $secretKey = & venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
    @"
SECRET_KEY=$secretKey
ADMIN_DEFAULT_PASSWORD=$adminPw
OLLAMA_MODEL=$Model
OLLAMA_URL=http://localhost:11434
ALLOWED_ORIGINS=http://localhost:3000
CADDY_CONFIG_PATH=../deploy/caddy/Caddyfile
CADDY_ADMIN_URL=http://localhost:2019
"@ | Set-Content -Path ".env" -Encoding UTF8
    Ok "Created backend\.env (admin username: admin)"
} else {
    Ok "backend\.env already exists, leaving it as-is"
}

# ── Frontend ────────────────────────────────────────────────────────────
Say "Setting up the frontend"
Set-Location "$RepoRoot\frontend"
if (-not (Test-Path "node_modules")) {
    npm install --no-fund --no-audit
} else {
    Ok "Frontend dependencies already installed"
}
if (-not (Test-Path ".env.local")) {
    "NEXT_PUBLIC_API_URL=" | Set-Content -Path ".env.local" -Encoding UTF8
}

# ── Seed the gateway allowlist with this machine's own address ─────────
# Picking the IP off the interface with the default route (rather than
# just "first non-loopback adapter") matters here specifically because
# Tailscale - part of this same setup flow - adds its own virtual adapter,
# which a naive filter could pick instead of the real LAN address.
Say "Configuring network access"
$LanIp = $null
try {
    $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop | Sort-Object RouteMetric | Select-Object -First 1
    if ($defaultRoute) {
        $LanIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.InterfaceIndex -ErrorAction Stop | Select-Object -First 1 -ExpandProperty IPAddress)
    }
} catch {}
if (-not $LanIp) {
    $LanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceAlias -notmatch "Loopback|Tailscale" -and $_.IPAddress -notmatch "^169\.254\." -and $_.IPAddress -ne "127.0.0.1"
    } | Select-Object -First 1 -ExpandProperty IPAddress)
}
$NetworkAccessFile = "$RepoRoot\backend\network_access.json"
if (-not (Test-Path $NetworkAccessFile) -and $LanIp) {
    $entryId = [guid]::NewGuid().ToString()
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")
    @"
{
  "$entryId": {
    "id": "$entryId",
    "ip": "$LanIp",
    "label": "This computer",
    "created_at": "$now"
  }
}
"@ | Set-Content -Path $NetworkAccessFile -Encoding UTF8
    Ok "Trusted this computer's address ($LanIp) - add more from the admin dashboard's Network Access tab"
} else {
    Ok "Network access list already configured"
}

# ── Register auto-start services ────────────────────────────────────────
Say "Registering background services (auto-start on login)"
& "$PSScriptRoot\install-services.ps1"

# ── Wait for it to come up, then open it ────────────────────────────────
Say "Waiting for the app to start"
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:8000" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Invoke-WebRequest -Uri "https://localhost:8443" -UseBasicParsing -TimeoutSec 2 -SkipCertificateCheck | Out-Null
        break
    } catch { Start-Sleep -Seconds 1 }
}

# The gateway serves HTTPS with a certificate from Caddy's own local CA
# (no public domain or internet dependency). `caddy trust` installs that
# CA into this machine's certificate store so its own browser shows a
# clean padlock instead of a warning. Other devices still see a one-time
# warning the first time they open the link unless that CA is installed
# on them too - see GUIDE.md.
Say "Trusting this machine's local HTTPS certificate"
try {
    caddy trust 2>&1 | Out-Null
    Ok "This machine will show a clean padlock, no warning"
} catch {
    Write-Host "  Could not install the certificate automatically - you may see a browser warning on this machine too. Try running 'caddy trust' as Administrator."
}

$GatewayUrl = "https://$(if ($LanIp) { $LanIp } else { 'localhost' }):8443"
Write-Host ""
Write-Host "=========================================="
Write-Host "  Setup complete"
Write-Host "=========================================="
Write-Host "  App URL:        $GatewayUrl"
Write-Host "  Admin username: admin"
Write-Host "  (Password is whatever you just set above)"
Write-Host ""
Write-Host "  See GUIDE.md for how to let coworkers and remote devices connect."
Write-Host "=========================================="
Start-Process $GatewayUrl
