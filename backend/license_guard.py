"""Per-company license enforcement.

Each sold copy ships with a license.json naming one company, signed by the
vendor's private key (kept outside this repo, never shipped - see
deploy/license/README.md). This module verifies that signature against the
public key embedded below, then locks the license to whichever machine
first runs it, refusing to start anywhere else.

Threat model, stated plainly: this stops the license file being copied to
a different company's install and just working (signature covers the
company name, so editing it invalidates the signature), and stops the same
purchase being activated on a second machine - not just by local file
state (which a determined buyer could delete) but by a remote check the
FIRST time a license activates: whichever machine calls home first
permanently claims that license_id in the license server's records, and
every later activation attempt from a different machine is rejected by
the server itself, not just by a local file that could be tampered with.
Deleting backend/.license_activation.json no longer helps - re-running
setup just re-contacts the same server, which still says no.

This only calls out to the network on that FIRST activation. After that,
the local activation file is sufficient on its own (the server-side claim
can't be reassigned to a different machine), so day-to-day operation never
depends on internet access - that's what keeps "runs locally" true. If
LICENSE_SERVER_URL isn't configured, remote activation is skipped with a
loud warning rather than silently degrading to local-only enforcement.
"""
import json
import os
import platform
import re
import subprocess
import sys
import uuid
import hashlib
from datetime import datetime
from pathlib import Path

import requests
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from cryptography.exceptions import InvalidSignature

LICENSE_FILE = Path(os.getenv("LICENSE_FILE", Path(__file__).parent / "license.json"))
ACTIVATION_FILE = Path(__file__).parent / ".license_activation.json"
PUBLIC_KEY_FILE = Path(__file__).parent / "license_public_key.pem"
# Set after deploying deploy/license-server/ (see its README) - the same
# server URL for every customer's copy, since it just tracks which
# license_id belongs to which machine, not anything company-specific.
LICENSE_SERVER_URL = os.getenv("LICENSE_SERVER_URL", "")


def _canonical_payload(data: dict) -> bytes:
    payload = {k: data[k] for k in ("license_id", "company", "issued_at")}
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def _hardware_id() -> str | None:
    """A boot-invariant hardware identifier, where the OS exposes one.

    Deliberately NOT uuid.getnode(): that's MAC-address-derived, and on a
    machine with more than one network interface (Wi-Fi, Ethernet, a VPN's
    utun adapter, Docker's bridge, AirDrop's awdl0, ...) Python doesn't
    guarantee which interface's MAC it picks, or that it picks the same one
    on every boot - interface enumeration order can change across a
    restart with zero hardware change. That produces a different
    "machine_id" for the exact same physical machine, which is what a
    license lockout after a reboot almost always means. These IDs come
    from the OS/firmware instead, not from networking, so they don't move
    when interfaces come and go.
    """
    try:
        if platform.system() == "Darwin":
            out = subprocess.run(
                ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            m = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', out)
            if m:
                return m.group(1)
        elif platform.system() == "Linux":
            for path in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
                p = Path(path)
                if p.exists():
                    value = p.read_text().strip()
                    if value:
                        return value
        elif platform.system() == "Windows":
            out = subprocess.run(
                ["reg", "query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            m = re.search(r"MachineGuid\s+REG_SZ\s+(\S+)", out)
            if m:
                return m.group(1)
    except Exception:
        pass
    return None


def _machine_id() -> str:
    """A reasonably stable per-machine fingerprint - not a security
    boundary by itself (see module docstring), just what a license gets
    locked to. Prefers a real hardware ID (see _hardware_id); only falls
    back to the old hostname+MAC scheme where the OS gives us nothing
    better, since that fallback is exactly what makes this brittle."""
    hw_id = _hardware_id()
    raw = hw_id if hw_id else f"{platform.node()}:{uuid.getnode()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _legacy_machine_id() -> str:
    """The old hostname+MAC fingerprint, kept only so an activation created
    before _machine_id started preferring hardware IDs still matches on
    this same machine - without this, switching formulas would lock every
    already-activated install out on its next restart, the same bug this
    change is fixing, just for everyone instead of no one."""
    raw = f"{platform.node()}:{uuid.getnode()}"
    return hashlib.sha256(raw.encode()).hexdigest()


class LicenseError(Exception):
    pass


def _activate_remote(data: dict, machine_id: str) -> None:
    """Contact the license server exactly once, at first activation. Raises
    LicenseError if the server explicitly denies it (already claimed by a
    different machine) or if it can't be reached at all - first activation
    is the one moment this app requires internet, deliberately, since
    that's the only way "used more than once" can be enforced for real."""
    if not LICENSE_SERVER_URL:
        print("=" * 70)
        print("LICENSE WARNING: LICENSE_SERVER_URL is not configured.")
        print("Activating locally only - this license is NOT protected against")
        print("being reactivated on a different machine after this file is deleted.")
        print("=" * 70)
        return

    try:
        resp = requests.post(
            f"{LICENSE_SERVER_URL.rstrip('/')}/activate",
            json={**{k: data[k] for k in ("license_id", "company", "issued_at", "signature")}, "machine_id": machine_id},
            timeout=15,
        )
    except requests.RequestException as e:
        raise LicenseError(
            f"Could not reach the license server to activate ({e}). "
            "An internet connection is required the first time this app runs - after that it works fully offline."
        )

    try:
        result = resp.json()
    except ValueError:
        raise LicenseError(f"License server returned an unexpected response (HTTP {resp.status_code}).")

    if result.get("status") in ("activated", "ok"):
        return
    raise LicenseError(result.get("detail") or "License server rejected activation.")


def _verify_signature(data: dict) -> None:
    if not PUBLIC_KEY_FILE.exists():
        raise LicenseError("license_public_key.pem is missing from the app - reinstall from a clean copy.")
    public_key: Ed25519PublicKey = load_pem_public_key(PUBLIC_KEY_FILE.read_bytes())
    try:
        signature = bytes.fromhex(data["signature"])
    except (KeyError, ValueError):
        raise LicenseError("License file is malformed (bad signature encoding).")
    try:
        public_key.verify(signature, _canonical_payload(data))
    except InvalidSignature:
        raise LicenseError("License signature is invalid - this license.json was not issued by the vendor, or has been edited (e.g. the company name changed) since it was issued.")


def enforce() -> dict:
    """Call once at startup, before anything else serves traffic. Raises
    LicenseError (caller should print it and exit) or returns the verified
    license dict on success."""
    if not LICENSE_FILE.exists():
        raise LicenseError(
            f"No license installed - expected {LICENSE_FILE}. "
            "This copy of the app cannot run without a license.json issued for your company."
        )
    try:
        data = json.loads(LICENSE_FILE.read_text())
    except Exception as e:
        raise LicenseError(f"license.json is not valid JSON: {e}")

    for field in ("license_id", "company", "issued_at", "signature"):
        if field not in data:
            raise LicenseError(f"license.json is missing required field '{field}'.")

    _verify_signature(data)

    machine_id = _machine_id()
    if ACTIVATION_FILE.exists():
        try:
            activation = json.loads(ACTIVATION_FILE.read_text())
        except Exception:
            raise LicenseError(f"{ACTIVATION_FILE.name} is corrupted - delete it only if you are certain this is the license's intended machine, then restart.")
        if activation.get("license_id") != data["license_id"]:
            raise LicenseError("This machine was already activated with a different license. Contact the vendor if you believe this is an error.")
        if activation.get("machine_id") != machine_id:
            if activation.get("machine_id") == _legacy_machine_id():
                # Activated before this file switched to hardware-based
                # fingerprinting - same machine, just recorded under the old
                # formula. Upgrade it transparently instead of locking out.
                ACTIVATION_FILE.write_text(json.dumps({
                    "license_id": data["license_id"],
                    "machine_id": machine_id,
                    "activated_at": activation.get("activated_at", datetime.utcnow().isoformat() + "Z"),
                }, indent=2))
            else:
                raise LicenseError(
                    "This license is already activated on a different machine. "
                    "Each purchase is locked to the first machine it runs on and cannot be moved by copying files."
                )
    else:
        _activate_remote(data, machine_id)
        ACTIVATION_FILE.write_text(json.dumps({
            "license_id": data["license_id"],
            "machine_id": machine_id,
            "activated_at": datetime.utcnow().isoformat() + "Z",
        }, indent=2))
        print(f"License activated on this machine for: {data['company']}")

    return data
