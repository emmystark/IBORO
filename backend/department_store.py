import json
import re
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime


class DepartmentStore:
    """Departments documents/chats can be scoped to.

    "general" is a fixed pseudo-department (company-wide knowledge, visible
    to everyone) and is never stored here - it's just the sentinel value
    "general" used directly in document metadata and chat scope. Everything
    in this store is a real, deletable department with an optional head
    (a user_id granted upload rights scoped to that one department).
    """

    GENERAL = "general"

    def __init__(self, storage_file: str = None):
        if storage_file is None:
            storage_file = str(Path(__file__).parent / "departments.json")
        self.storage_file = Path(storage_file)
        self.departments: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        if self.storage_file.exists():
            try:
                with open(self.storage_file) as f:
                    self.departments = json.load(f)
                return
            except Exception as e:
                print(f"Error loading departments: {e}")
        self.departments = {}

    def save(self):
        try:
            with open(self.storage_file, "w") as f:
                json.dump(self.departments, f, indent=2)
        except Exception as e:
            print(f"Error saving departments: {e}")

    def _slugify(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "department"
        if base == self.GENERAL:
            base = "department"
        slug = base
        i = 2
        while slug in self.departments:
            slug = f"{base}-{i}"
            i += 1
        return slug

    def list_departments(self) -> List[Dict[str, Any]]:
        return list(self.departments.values())

    def get_department(self, department_id: str) -> Optional[Dict[str, Any]]:
        return self.departments.get(department_id)

    def exists(self, department_id: str) -> bool:
        return department_id == self.GENERAL or department_id in self.departments

    def create_department(self, name: str) -> Dict[str, Any]:
        name = name.strip()
        if not name:
            raise Exception("Department name required")
        department_id = self._slugify(name)
        department = {
            "id": department_id,
            "name": name,
            "head_user_id": None,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self.departments[department_id] = department
        self.save()
        return department

    def update_department(self, department_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        department = self.departments.get(department_id)
        if not department:
            raise Exception("Department not found")
        department.update(updates)
        self.save()
        return department

    def delete_department(self, department_id: str) -> Dict[str, Any]:
        department = self.departments.get(department_id)
        if not department:
            raise Exception("Department not found")
        del self.departments[department_id]
        self.save()
        return department
