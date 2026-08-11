import json
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

BUILTIN_ROLE_IDS = ("admin", "manager", "user")


class RoleStore:
    """Named roles a user can be assigned.

    admin/manager/user are built-in and protected (can't be renamed or
    deleted). Custom roles are deliberately just labels - every permission
    check in app.py compares role == "admin"/"manager" explicitly, so a
    custom role automatically gets the same basic access as "user" without
    needing a permissions table here.
    """

    def __init__(self, storage_file: str = None):
        if storage_file is None:
            storage_file = str(Path(__file__).parent / "roles.json")
        self.storage_file = Path(storage_file)
        self.roles: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        if self.storage_file.exists():
            try:
                with open(self.storage_file) as f:
                    self.roles = json.load(f)
                return
            except Exception as e:
                print(f"Error loading roles: {e}")
        self.roles = {}
        self._seed_builtins()

    def save(self):
        try:
            with open(self.storage_file, "w") as f:
                json.dump(self.roles, f, indent=2)
        except Exception as e:
            print(f"Error saving roles: {e}")

    def _seed_builtins(self):
        for role_id in BUILTIN_ROLE_IDS:
            self.roles[role_id] = {
                "id": role_id,
                "name": role_id.capitalize(),
                "is_builtin": True,
                "created_at": datetime.utcnow().isoformat() + "Z",
            }
        self.save()

    def _slugify(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "role"
        slug = base
        i = 2
        while slug in self.roles:
            slug = f"{base}-{i}"
            i += 1
        return slug

    def list_roles(self) -> List[Dict[str, Any]]:
        return list(self.roles.values())

    def role_exists(self, role_id: str) -> bool:
        return role_id in self.roles

    def create_role(self, name: str) -> Dict[str, Any]:
        name = name.strip()
        if not name:
            raise Exception("Role name required")
        if name.lower() in BUILTIN_ROLE_IDS:
            raise Exception(f"'{name}' is a reserved role name")
        role_id = self._slugify(name)
        role = {
            "id": role_id,
            "name": name,
            "is_builtin": False,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self.roles[role_id] = role
        self.save()
        return role

    def delete_role(self, role_id: str) -> Dict[str, Any]:
        role = self.roles.get(role_id)
        if not role:
            raise Exception("Role not found")
        if role.get("is_builtin"):
            raise Exception("Built-in roles can't be deleted")
        del self.roles[role_id]
        self.save()
        return role
