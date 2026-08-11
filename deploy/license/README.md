# Per-company licensing

Each copy of this app you sell must contain a `backend/license.json` naming the exact company it was sold to. The app verifies that file's signature at startup and refuses to run without it, and locks it to the first machine it runs on.

**See `OPERATIONS.md` in this folder** for the actual day-to-day workflow (issuing a license per sale, tracking who has what, and alternatives to Cloudflare for the remote activation check). This file covers the one-time setup and the underlying design.

## One-time setup (you've already done this once)

A signing keypair lives at `~/iboro-vendor-keys/` on this machine - `private_key.pem` (never share, never commit, this is what lets you issue valid licenses) and `public_key.pem` (copied into `backend/license_public_key.pem`, which ships with the app - that's fine, public keys are meant to be public).

**Back up `~/iboro-vendor-keys/private_key.pem` somewhere safe outside this repo** (a password manager, encrypted drive, etc). If you lose it, you can't issue new licenses and will need to generate a new keypair, re-embed the new public key in the app, and re-license every existing customer.

## Issuing a license for a new sale

```bash
cd /Volumes/Stark/Repo/Rag-chatbot/backend
venv/bin/python ../deploy/license/issue_license.py --company "Acme Corp" --private-key ~/iboro-vendor-keys/private_key.pem --out license.json
```

This writes `backend/license.json` and prints the license ID - keep a record of which ID went to which company (a spreadsheet is fine) for your own support/audit trail.

Then package up the repo (including this `license.json`) for that customer as normal - it's now locked to their eventual server the moment they first run it.

## What this does and doesn't protect against

- **Does stop:** editing the license file to change the company name (breaks the signature), copying an already-activated install's files to a second machine (the activation lock won't match), and someone without your private key forging a license for themselves.
- **Doesn't stop:** a customer who is willing to read `backend/license_guard.py` and delete `backend/.license_activation.json` to re-activate on a different machine. This is a fundamental limit of any check that runs entirely on hardware you don't control with no server to verify against - there is no way to make client-side code un-bypassable. If you need stronger enforcement (e.g. a hard cap on how many times a license can activate, or the ability to revoke one remotely), that requires standing up a small server you control that the app checks in with, which is a separate project.

## If a customer's machine dies and needs replacing

The activation lock has no "reset" button by design (that's what makes it meaningful at all). If a legitimate customer needs to move to new hardware, delete their `backend/.license_activation.json` yourself (or walk them through it) - that's a deliberate manual step, not something the app does automatically.
