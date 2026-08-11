# License activation server (Cloudflare Workers)

Tracks which machine has claimed each license, so a license that's already active on one machine is rejected everywhere else - even if `backend/.license_activation.json` gets deleted locally. See `backend/license_guard.py` for exactly what this does and doesn't add over local-only enforcement.

You only deploy this **once**. Every license you issue afterward (`deploy/license/issue_license.py`) automatically uses it, as long as `LICENSE_SERVER_URL` is set in `backend/.env` before you package a copy for a customer.

## One-time setup

1. **Create a free Cloudflare account** at [cloudflare.com](https://cloudflare.com) if you don't have one already (no credit card needed for this).

2. **Create the storage** (KV namespace) this server uses to remember activations:

   ```bash
   cd /Volumes/Stark/Repo/Rag-chatbot/deploy/license-server
   npx wrangler kv namespace create LICENSES
   ```

   This opens your browser once to log into Cloudflare (`wrangler login` will trigger automatically if you're not already logged in - just approve it). It then prints something like:

   ```
   { binding = "LICENSES", id = "abc123..." }
   ```

   Copy that `id` value into `wrangler.toml` in this folder, replacing `REPLACE_WITH_KV_NAMESPACE_ID`.

3. **Deploy it:**

   ```bash
   npx wrangler deploy
   ```

   This prints a URL like `https://iboro-license-server.<your-subdomain>.workers.dev` - that's your permanent license server URL.

4. **Wire it into the app:** add that URL to `backend/.env`:

   ```
   LICENSE_SERVER_URL=https://iboro-license-server.<your-subdomain>.workers.dev
   ```

   Do this once in your own working copy - every `license.json` you issue and every copy you package from here on out will use it automatically.

## Verifying it worked

```bash
curl https://iboro-license-server.<your-subdomain>.workers.dev/health
```

Should return `{"status":"ok"}`.

## Checking or managing activations

Cloudflare's dashboard (Workers & Pages → KV → LICENSES) lets you browse every activated license_id and which machine claimed it - useful for support, and for manually deleting an entry if a legitimate customer needs to move to new hardware (matches the manual-reset process in `deploy/license/README.md`).

## Cost

Cloudflare's free tier is 100,000 requests/day - this server gets one request per customer install, ever (plus the odd `/health` check), so you will not come close to hitting a paid tier from this alone.
