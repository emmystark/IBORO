# Iboro: Setup & Access Guide

## Starting and stopping

Use the file for your operating system:

| | Start | Stop |
|---|---|---|
| macOS | `Start Iboro.command` | `Stop Iboro.command` |
| Windows | `Start Iboro (Windows).bat` | `Stop Iboro (Windows).bat` |
| Linux | `Start Iboro (Linux).sh` | `Stop Iboro (Linux).sh` |

- **First time:** double-click (or right-click, Run, on Linux). It installs everything it needs (this can take 10-20 minutes the first time, mostly downloading the AI model), then opens the app in your browser.
- **Every time after:** double-click the same file again. It just checks everything is running and opens the app, usually a few seconds.
- **To stop it:** use the matching Stop file. This stops the app from running in the background and from auto-starting on login. Nothing is deleted, start it again any time.
- The app keeps running in the background even after you close the terminal window or restart the computer; you don't need to leave anything open.
- On Linux, if double-clicking a `.sh` file just opens it in a text editor (common default), right-click it and choose Run, or Run in terminal, or run it from a terminal: `bash "Start Iboro (Linux).sh"`.

## Who can access the app

The app is only reachable by devices you've explicitly allowed, anyone else gets blocked before they even see a login screen. There are two ways a device gets access, for two different situations.

### 1. Devices on the same office/home network

Use this for desktops, laptops, and phones that always connect from the same physical location (the office Wi-Fi, a home router).

1. Log in as `admin` and open the **Network access** tab in the dashboard.
2. You'll see a **shareable link** (e.g. `http://192.168.1.42:8080`), send this to your team.
3. To let a new device in: get its IP address (the device owner can search "what's my IP" in a browser, or you can check your router's list of connected devices) and add it under **On-site & office devices**.

**Limitation:** if a device's IP address changes (new router, different network), it'll need to be re-added. For anything that moves around, use Tailscale instead (below).

### 2. Remote or roaming devices (phones, laptops that travel)

Use this for anyone working from home, a coffee shop, another office, or switching networks throughout the day. IP addresses aren't reliable for these, they change too often, especially on cellular. **Tailscale** solves this by giving each device a fixed identity that keeps working no matter what network it's on.

**One-time setup, per device:**

1. Install the free **Tailscale** app:
   - Mac/Windows/Linux: [tailscale.com/download](https://tailscale.com/download)
   - iPhone/Android: search "Tailscale" in the App Store / Play Store
2. Sign in with the same account on every device you want connected (this Mac included, if it isn't set up yet, run `sudo tailscale up` in Terminal on the Mac and sign in there first).
3. Approve the new device once at [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines).
4. Done. That device can now reach the app at `http://<this-mac's-tailscale-address>:8080` from anywhere, no need to touch the Network Access page again, ever, for that device.

Find "this Mac's Tailscale address" by running `tailscale ip -4` in Terminal on the Mac, or by looking up "this-mac" in the same admin console page above.

## Department heads and document uploads

- Admins assign a **head** to each department from the **Departments** tab.
- A department head can upload documents only to the department(s) they head, not to "General" (company-wide knowledge stays admin/manager-only).
- Everyone else can search and chat with whatever documents are in their department plus General, but can't upload.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Forbidden" page instead of login | This device's IP isn't on the allowlist (or it changed), see "Who can access the app" above. |
| Login page loads but signing in fails ("Load failed") | The app was opened via an unusual address it doesn't recognize, try the shareable link shown in the Network Access tab instead. |
| Chat replies with an error mentioning "localhost:11434" | The AI engine (Ollama) isn't running, run the Start file for your OS again to restart everything. |
| Chat takes 60+ seconds to respond the first time, then is fast after | Normal on the very first message after the app starts, the AI model has to load into memory once. It stays loaded after that. |
| macOS: nothing happens after double-clicking the Start file | Right-click it and choose Open (macOS blocks unsigned scripts from double-click the very first time), then allow it in System Settings, Privacy & Security if prompted. |
| Windows: "Windows protected your PC" (SmartScreen) appears | Click "More info", then "Run anyway". This warning is normal for a script that isn't signed by a registered publisher. |
| Windows: setup fails saying winget isn't found | Install "App Installer" from the Microsoft Store, then run the Start file again. |
| Linux: double-clicking the Start file opens it in a text editor instead of running it | Right-click it and choose Run (wording varies by desktop environment), or run `bash "Start Iboro (Linux).sh"` from a terminal. |
