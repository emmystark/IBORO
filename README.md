# Iboro

A private, on-premise document search & chat app.

## Getting started

Double-click the file for your operating system. That's it, it installs everything needed (Python, Node, Ollama, the AI model, Caddy), starts the app, and opens it in your browser. Safe to double-click again any time; it just checks everything's running.

- **macOS:** `Start Iboro.command`
- **Windows:** `Start Iboro (Windows).bat`
- **Linux:** `Start Iboro (Linux).sh` (right-click, Run, if double-click just opens it in a text editor)

To stop the app (and stop it auto-starting on login), use the matching `Stop ...` file.

See **[GUIDE.md](GUIDE.md)** for how to let coworkers and remote devices connect, and for troubleshooting.

## For developers

- `backend/` - FastAPI + a local Ollama model, retrieval over Chroma
- `frontend/` - Next.js
- `deploy/` - the Caddy gateway, auto-start service files per platform (launchd/systemd/Task Scheduler), and the setup scripts the double-click files call
