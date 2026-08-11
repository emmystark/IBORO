# Packaging Iboro for a customer

Turns the app into a single file someone double-clicks (or runs) to install and start everything — no folders to open, no terminal commands to type, no visible source code beyond what's technically unavoidable (see the note on frontend code below).

**Before packaging for a real sale:** replace `backend/license.json` in this repo with the actual customer's license (see `deploy/license/README.md`) — every build below bundles whatever's currently in that file. The repo currently has a demo license ("Stark Demo Co") that must not ship to a real customer.

## macOS — fully built and tested tonight

```bash
bash packaging/macos/build.sh
```

Produces two real, working `.app` files in `packaging/macos/dist/`:
- **`Iboro (Thin).app`** (~2MB) — small, downloads the AI model on first launch (needs internet once)
- **`Iboro (Full).app`** (~1.8GB) — bundles the model, works with zero internet from the first launch

Both were built and verified end-to-end tonight: double-click → installs to `~/Library/Application Support/Iboro/` → runs the same setup flow as `deploy/setup.sh` → opens the app. Just an icon in Finder; the source only becomes visible via a deliberate right-click → "Show Package Contents."

## Windows — config written, needs building on an actual Windows machine

`packaging/windows/` has everything needed (`iboro.iss` for Inno Setup, `start.ps1`, model-bundling instructions) — see `packaging/windows/BUILD.md` for the exact commands. A Mac cannot compile a `.exe`, so this step has to happen on Windows.

## Linux — built and the extraction mechanism tested tonight; full run needs a real Linux machine

```bash
bash packaging/linux/build.sh thin   # or: full
```

Produces a single self-extracting `Iboro-Install-thin.run` in `packaging/linux/dist/`. Unlike Windows, this **was** built and its self-extraction/install-copy logic verified end-to-end from this Mac (it's just a shell script with a tar.gz payload, no cross-compilation) — it correctly unpacks and hands off to `deploy/linux/setup.sh`, which then needs an actual Linux machine (`apt`/`dnf`) to finish the real install.

## On "not openable at all"

Two honest limits, worth knowing before promising this to a customer:
- **Backend (Python):** genuinely close to un-readable as shipped — regular source files, not a compiled binary. If you want it compiled to a real binary (PyInstaller), that's a bigger follow-up task, not done here.
- **Frontend (browser JavaScript):** can never be fully hidden. Browsers must receive and run this code to render the page, so anyone can always open dev tools and see it — true of every website/web app that exists, not a limitation specific to this build.
