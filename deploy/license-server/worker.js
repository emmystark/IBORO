/**
 * License activation server. First-activation-wins: whichever machine
 * calls /activate first for a given license_id claims it permanently in
 * KV; every later call from a *different* machine for the same
 * license_id is denied. A call from the SAME machine that already owns
 * it always succeeds (idempotent), so re-running setup on the same
 * machine never breaks.
 *
 * This only needs to be called ONCE per install, at first activation -
 * after that the app's local activation lock is sufficient (the KV
 * record can never be reassigned to a different machine), so daily use
 * never depends on this server being reachable. That's what keeps "runs
 * locally" true while still closing the "copy the folder to a second
 * company" gap - see backend/license_guard.py for the client side.
 *
 * PUBLIC_KEY_B64 below must exactly match backend/license_public_key.pem
 * (the raw 32-byte Ed25519 public key, base64-encoded - this file embeds
 * the same key differently because Workers' WebCrypto wants raw bytes,
 * not PEM). Re-run scripts/pem_to_raw.py if you ever rotate the vendor
 * keypair.
 */

const PUBLIC_KEY_B64 = "OmILQ1pFdfNSZ4N/+4pKAF/H/jgMzwbZNqOkhXTafUY=";

function canonicalPayload(data) {
  // Must match _canonical_payload() in backend/license_guard.py exactly -
  // same three fields, same key order, same separators - or every
  // signature verification will fail.
  const payload = {
    company: data.company,
    issued_at: data.issued_at,
    license_id: data.license_id,
  };
  return new TextEncoder().encode(JSON.stringify(payload));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function verifySignature(data) {
  const keyBytes = Uint8Array.from(atob(PUBLIC_KEY_B64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const signature = hexToBytes(data.signature);
  return crypto.subtle.verify("Ed25519", key, signature, canonicalPayload(data));
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/activate" && request.method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch {
        return json({ status: "error", detail: "Invalid JSON body" }, 400);
      }

      for (const field of ["license_id", "company", "issued_at", "signature", "machine_id"]) {
        if (!data[field]) return json({ status: "error", detail: `Missing field: ${field}` }, 400);
      }

      let validSignature;
      try {
        validSignature = await verifySignature(data);
      } catch (e) {
        return json({ status: "error", detail: "Signature verification failed: " + e.message }, 400);
      }
      if (!validSignature) {
        return json({ status: "error", detail: "Invalid signature - this license was not issued by the vendor, or the payload has been altered" }, 403);
      }

      const existingRaw = await env.LICENSES.get(data.license_id);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (existing.machine_id === data.machine_id) {
          return json({ status: "ok", detail: "Already activated on this machine" });
        }
        return json({
          status: "denied",
          detail: "This license is already activated on a different machine.",
        }, 403);
      }

      await env.LICENSES.put(data.license_id, JSON.stringify({
        machine_id: data.machine_id,
        company: data.company,
        activated_at: new Date().toISOString(),
      }));
      return json({ status: "activated" });
    }

    if (url.pathname === "/health") {
      return json({ status: "ok" });
    }

    return json({ status: "error", detail: "Not found" }, 404);
  },
};
