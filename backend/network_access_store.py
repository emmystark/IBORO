import ipaddress
import json
import uuid
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime


class NetworkAccessStore:
    """Trusted IPs/CIDR ranges allowed through the Caddy gateway.

    This is the on-premise "proximity" allowlist only - remote/roaming
    devices are handled separately via Tailscale (their tailnet range is
    trusted unconditionally by the gateway, since Tailscale itself already
    gates device membership). See app.py's sync_caddy_allowlist().
    """

    def __init__(self, storage_file: str = None):
        if storage_file is None:
            storage_file = str(Path(__file__).parent / "network_access.json")
        self.storage_file = Path(storage_file)
        self.entries: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        if self.storage_file.exists():
            try:
                with open(self.storage_file) as f:
                    self.entries = json.load(f)
                return
            except Exception as e:
                print(f"Error loading network access list: {e}")
        self.entries = {}

    def save(self):
        try:
            with open(self.storage_file, "w") as f:
                json.dump(self.entries, f, indent=2)
        except Exception as e:
            print(f"Error saving network access list: {e}")

    def list_entries(self) -> List[Dict[str, Any]]:
        return sorted(self.entries.values(), key=lambda e: e.get("created_at", ""))

    def add_entry(self, ip_or_cidr: str, label: str) -> Dict[str, Any]:
        ip_or_cidr = ip_or_cidr.strip()
        try:
            ipaddress.ip_network(ip_or_cidr, strict=False)
        except ValueError:
            raise Exception(f"'{ip_or_cidr}' is not a valid IP address or CIDR range")
        if any(e["ip"] == ip_or_cidr for e in self.entries.values()):
            raise Exception(f"'{ip_or_cidr}' is already on the allowlist")
        entry_id = str(uuid.uuid4())
        entry = {
            "id": entry_id,
            "ip": ip_or_cidr,
            "label": label.strip() or ip_or_cidr,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self.entries[entry_id] = entry
        self.save()
        return entry

    def delete_entry(self, entry_id: str) -> Dict[str, Any]:
        entry = self.entries.get(entry_id)
        if not entry:
            raise Exception("Entry not found")
        del self.entries[entry_id]
        self.save()
        return entry
