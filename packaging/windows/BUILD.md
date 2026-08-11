# Building the Windows installer

This produces a single `Iboro-Setup.exe` a customer double-clicks to install and run everything - no folders, no visible source. **Must be built on an actual Windows machine** (a Mac can't compile a `.exe`).

## One-time setup on the Windows build machine

1. Install [Inno Setup](https://jrsoftware.org/isinfo.php) (free)
2. Copy this whole repo onto that Windows machine
3. **Replace `backend/license.json`** with the real customer's license (issued via `deploy/license/issue_license.py` - see `deploy/license/README.md`). The demo one in this repo (`Stark Demo Co`) must not ship to a real customer.

## Build the Thin installer (small file, downloads the AI model on first run)

```
cd packaging\windows
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" /DTHIN=1 iboro.iss
```

Output: `packaging\windows\dist\Iboro-Setup.exe`

## Build the Full installer (larger file, works fully offline from first launch)

1. Populate `packaging\windows\model\` first - see `model\README.txt` for the exact steps (copies the model's manifest + blob files out of a working Ollama install)
2. Then compile without the THIN flag:

```
cd packaging\windows
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" iboro.iss
```

## What the installer actually does

Same setup flow as `deploy/setup.sh` on Mac, just wrapped in `start.ps1` and triggered by the installer instead of a terminal command: installs winget-managed dependencies (Python, Node, Ollama, Caddy), pulls or seeds the AI model, configures `.env`/license/network access, and registers everything to auto-start via Task Scheduler. First launch after install runs this automatically (checkbox is pre-checked); every launch after that just confirms things are running and opens the app.
