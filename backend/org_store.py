import json
import re
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List


class OrgStore:
    """Lightweight multi-tenant org layer on top of UserStore.

    Each org has members with a role (owner/admin/member). A user can
    belong to several orgs and switch the "active" one, similar to a
    Slack workspace switcher.
    """

    def __init__(self, storage_file: str = None):
        if storage_file is None:
            storage_file = str(Path(__file__).parent / "organizations.json")
        self.storage_file = Path(storage_file)
        self.orgs: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        if self.storage_file.exists():
            try:
                with open(self.storage_file) as f:
                    self.orgs = json.load(f)
                return
            except Exception as e:
                print(f"Error loading organizations: {e}")
        self.orgs = {}

    def save(self):
        try:
            with open(self.storage_file, "w") as f:
                json.dump(self.orgs, f, indent=2)
        except Exception as e:
            print(f"Error saving organizations: {e}")

    def _slugify(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
        slug = base
        i = 2
        while slug in self.orgs:
            slug = f"{base}-{i}"
            i += 1
        return slug

    def create_org(self, name: str, owner_id: str, plan: str = "free") -> Dict[str, Any]:
        org_id = self._slugify(name)
        from datetime import datetime
        org = {
            "id": org_id,
            "name": name,
            "plan": plan,
            "owner_id": owner_id,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "members": {owner_id: "owner"},
        }
        self.orgs[org_id] = org
        self.save()
        return org

    def get_org(self, org_id: str) -> Optional[Dict[str, Any]]:
        return self.orgs.get(org_id)

    def get_or_create_for_company(self, company: str, owner_id: str) -> Dict[str, Any]:
        """Migration helper: find an org matching a legacy `company` name, or create it."""
        for org in self.orgs.values():
            if org["name"] == company:
                return org
        return self.create_org(company, owner_id)

    def user_orgs(self, user_id: str) -> List[Dict[str, Any]]:
        return [
            {**org, "role": org["members"][user_id]}
            for org in self.orgs.values()
            if user_id in org.get("members", {})
        ]

    def add_member(self, org_id: str, user_id: str, role: str = "member") -> Dict[str, Any]:
        org = self.orgs.get(org_id)
        if not org:
            raise Exception("Organization not found")
        org["members"][user_id] = role
        self.save()
        return org

    def remove_member(self, org_id: str, user_id: str) -> bool:
        org = self.orgs.get(org_id)
        if not org or user_id not in org.get("members", {}):
            return False
        if org.get("owner_id") == user_id:
            raise Exception("Cannot remove the org owner")
        del org["members"][user_id]
        self.save()
        return True

    def get_role(self, org_id: str, user_id: str) -> Optional[str]:
        org = self.orgs.get(org_id)
        if not org:
            return None
        return org.get("members", {}).get(user_id)

    def members(self, org_id: str) -> List[Dict[str, str]]:
        org = self.orgs.get(org_id)
        if not org:
            return []
        return [{"user_id": uid, "role": role} for uid, role in org["members"].items()]
