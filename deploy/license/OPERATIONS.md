# Running the license system day-to-day

Covers issuing a license for each sale, keeping track of who has what, and what to use instead of Cloudflare for the remote activation check while that's not set up.

## 1. Issuing a license (works right now, no server needed)

Every sale gets one signed `license.json`, generated on your machine with your private key (never the customer's):

```bash
cd /Volumes/Stark/Repo/Rag-chatbot/backend
venv/bin/python ../deploy/license/issue_license.py \
  --company "Acme Corp" \
  --private-key ~/iboro-vendor-keys/private_key.pem \
  --out license.json
```

This prints the `license_id` and writes `backend/license.json`. Copy that file into the copy of the repo you're packaging for that customer (see `packaging/README.md`) before building their `.app`/installer/`.run` file — it gets baked in.

**This step alone already enforces:**
- The license only works if the company name in it wasn't tampered with (signature check)
- Once activated, it's locked to whichever machine ran it first — copying the whole folder to a second machine and running it there gets refused

**What it does *not* stop without a remote server:** someone deleting `backend/.license_activation.json` on their own machine and reactivating — see the tradeoffs section in `deploy/license/README.md`. That gap is exactly what a remote server (Cloudflare Worker or an alternative below) closes.

## 2. Tracking who has what (manual, until you want something fancier)

There's no database for this yet — the simplest thing that actually works is a spreadsheet. One row per sale:

| license_id | company | issued_at | delivered (Y/N) | notes |
|---|---|---|---|---|
| b139217e-... | Acme Corp | 2026-08-06 | Y | macOS Thin |

The `issue_license.py` output prints everything you need for a row. Keep this spreadsheet **separately from the repo** (Google Sheets, Notes, whatever) — it's your customer list, not something to commit to git.

If a customer ever needs to move to new hardware, this sheet is also how you'll remember which `license_id` is theirs, to walk them through deleting `.license_activation.json` (see `deploy/license/README.md`'s last section).

## 3. Alternatives to Cloudflare for the remote activation check

The remote server's job is tiny: given a signed license + a machine ID, say yes the first time, no every time after from a different machine. `deploy/license-server/worker.js` already defines that exact contract (`POST /activate`, checks a signature, stores one record per `license_id`). Any of these can serve the same contract — swapping the host just means changing `LICENSE_SERVER_URL` in `.env`, nothing in `license_guard.py` needs to change.

**Ranked by how little setup they need:**

1. **Skip it for now (what's actually happening today).** Leave `LICENSE_SERVER_URL` blank. Every license enforces locally only (signature + single-machine lock, no remote check). This is a completely legitimate way to operate short-term — it's not "no protection," it's "protection minus the one gap described above." Revisit once you want that gap closed.

2. **PythonAnywhere (free tier).** A tiny always-on Flask app, no credit card, no CLI tooling fight like we hit with Wrangler tonight. I can write the ~30-line Flask equivalent of `worker.js` if you want this route — free tier easily covers a handful of activations.

3. **Google Sheets + Apps Script.** Genuinely free, no deploy step beyond pasting a script into a Sheet's Script Editor and clicking "Deploy as web app." Doubles as your tracking spreadsheet from section 2 — one place instead of two. Slightly more fiddly to secure properly (Apps Script web apps are a bit unusual to lock down), but zero new accounts needed if you already use Google Sheets.

4. **Retry Cloudflare later.** Everything for this is already built and tested up to the point you paused (worker code, KV namespace created, you're logged in) — finishing it is just picking a `workers.dev` subdomain at the link from earlier and running `npx wrangler deploy` from `deploy/license-server/`. Nothing wasted by waiting.

5. **Render / Railway / Fly.io free tiers.** Full small VM/container hosting, more capable than you need for this but an option if you're already using one of them for something else.

Given tonight's Wrangler login friction, **PythonAnywhere is probably the least painful path if you want a remote check today** — say the word and I'll write that version.
