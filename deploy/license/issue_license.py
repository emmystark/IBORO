#!/usr/bin/env python3
"""Seller-side tool: issue a signed license.json for one company's copy of
the app. Run this on YOUR machine, with YOUR private key - never ship this
script's private key, only the license.json it produces.

Usage:
    python3 issue_license.py --company "Acme Corp" --private-key ~/iboro-vendor-keys/private_key.pem [--out license.json]

Then copy the resulting license.json into backend/license.json of the copy
you're delivering to that company, before zipping/handing it off. Keep a
record of which license_id went to which company (this tool prints it) -
that's your own audit trail for support and any future "did we sell you
this" disputes.
"""
import argparse
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import load_pem_private_key


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--company", required=True, help="Exact company name this copy is licensed to")
    parser.add_argument("--private-key", required=True, type=Path, help="Path to your vendor private_key.pem (never share this file)")
    parser.add_argument("--out", type=Path, default=Path("license.json"), help="Output path (default: ./license.json)")
    parser.add_argument("--license-id", default=None, help="Override the auto-generated license ID (rarely needed)")
    args = parser.parse_args()

    if not args.private_key.exists():
        print(f"Private key not found: {args.private_key}", file=sys.stderr)
        sys.exit(1)

    private_key: Ed25519PrivateKey = load_pem_private_key(args.private_key.read_bytes(), password=None)

    license_id = args.license_id or str(uuid.uuid4())
    issued_at = datetime.utcnow().isoformat() + "Z"
    payload = {"license_id": license_id, "company": args.company, "issued_at": issued_at}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = private_key.sign(canonical)

    license_data = {**payload, "signature": signature.hex()}
    args.out.write_text(json.dumps(license_data, indent=2))

    print(f"Issued license for: {args.company}")
    print(f"  license_id: {license_id}")
    print(f"  issued_at:  {issued_at}")
    print(f"  written to: {args.out.resolve()}")
    print()
    print("Copy this file to backend/license.json in the copy you're delivering.")
    print("Keep a record of this license_id + company somewhere safe (spreadsheet, etc).")


if __name__ == "__main__":
    main()
