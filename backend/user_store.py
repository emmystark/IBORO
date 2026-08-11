import json
import os
import hashlib
import bcrypt as _bcrypt
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

_DEFAULT_SECRET_KEY = "dev-secret-key-please-change-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_SECRET_KEY)
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

if SECRET_KEY == _DEFAULT_SECRET_KEY:
    # This key signs every login token - anyone who knows it (it's public,
    # it's right here in the source) can forge a valid token for any user,
    # including admin, without ever knowing a password. Loud on purpose:
    # deploy/setup.sh always generates a real one, so landing here means
    # .env is missing or wasn't loaded, not a normal state to be in.
    print("=" * 70)
    print("SECURITY WARNING: SECRET_KEY is not set (using the public default).")
    print("Anyone can forge a login token for ANY account, including admin.")
    print("Set SECRET_KEY in backend/.env before exposing this to a network.")
    print("=" * 70)


class UserStore:
    def __init__(self, storage_file: str = None):
        if storage_file is None:
            storage_file = str(Path(__file__).parent / "users.json")
        self.storage_file = Path(storage_file)
        self.users: Dict[str, Dict[str, Any]] = {}
        self.load()

    def load(self):
        if self.storage_file.exists():
            try:
                with open(self.storage_file) as f:
                    self.users = json.load(f)
                print(f"✓ Loaded {len(self.users)} users")
            except Exception as e:
                print(f"Error loading users: {e}")
                self.users = {}
        else:
            self.users = {}
            self._create_default_admin()

    def save(self):
        try:
            with open(self.storage_file, "w") as f:
                json.dump(self.users, f, indent=2)
        except Exception as e:
            print(f"Error saving users: {e}")

    def _hash_password(self, password: str) -> str:
        # bcrypt has a 72-byte max - truncate to be safe
        return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt()).decode()

    def _verify_password(self, password: str, hashed: str, pw_version: str = "sha256") -> bool:
        if pw_version == "sha256":
            return hashlib.sha256(password.encode()).hexdigest() == hashed
        try:
            return _bcrypt.checkpw(password.encode()[:72], hashed.encode())
        except Exception:
            return False

    def _create_default_admin(self):
        admin_password = os.getenv("ADMIN_DEFAULT_PASSWORD", "admin123")
        self.users["admin"] = {
            "id": "admin",
            "username": "admin",
            "email": "admin@company.com",
            "password_hash": self._hash_password(admin_password),
            "pw_version": "bcrypt",
            "role": "admin",
            "company": "Company",
            "department_id": None,
            "can_upload": True,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "is_active": True,
            "is_deleted": False,
        }
        self.save()
        print("✓ Created default admin (password from ADMIN_DEFAULT_PASSWORD)")

    def create_access_token(self, user_id: str) -> str:
        expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
        return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> Optional[str]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload.get("sub")
        except JWTError:
            return None

    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        user = self.users.get(username)
        if not user or user.get("is_deleted") or not user.get("is_active"):
            return None

        pw_version = user.get("pw_version", "sha256")
        if not self._verify_password(password, user["password_hash"], pw_version):
            return None

        # Upgrade legacy SHA256 hashes to bcrypt on successful login
        if pw_version == "sha256":
            user["password_hash"] = self._hash_password(password)
            user["pw_version"] = "bcrypt"
            self.save()

        token = self.create_access_token(user["id"])
        result = {k: v for k, v in user.items() if k not in ("password_hash", "pw_version")}
        result["token"] = token
        return result

    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        role: str = "user",
        company: str = "Company",
        department_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if username in self.users:
            raise Exception(f"User '{username}' already exists")

        user = {
            "id": username,
            "username": username,
            "email": email,
            "password_hash": self._hash_password(password),
            "pw_version": "bcrypt",
            "role": role,
            "company": company,
            "department_id": department_id,
            "can_upload": role in ("admin", "manager"),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "is_active": True,
            "is_deleted": False,
        }
        self.users[username] = user
        self.save()
        return {k: v for k, v in user.items() if k not in ("password_hash", "pw_version")}

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        user = self.users.get(user_id)
        if user and not user.get("is_deleted"):
            return {k: v for k, v in user.items() if k not in ("password_hash", "pw_version")}
        return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        return [
            {k: v for k, v in u.items() if k not in ("password_hash", "pw_version")}
            for u in self.users.values()
            if not u.get("is_deleted")
        ]

    def get_company_users(self, company: str) -> List[Dict[str, Any]]:
        return [
            {k: v for k, v in u.items() if k not in ("password_hash", "pw_version")}
            for u in self.users.values()
            if u.get("company") == company and not u.get("is_deleted")
        ]

    def update_user(self, user_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        if user_id not in self.users:
            raise Exception(f"User '{user_id}' not found")
        user = self.users[user_id]
        if "password" in updates:
            user["password_hash"] = self._hash_password(updates.pop("password"))
            user["pw_version"] = "bcrypt"
        user.update(updates)
        user["updated_at"] = datetime.utcnow().isoformat() + "Z"
        self.save()
        return {k: v for k, v in user.items() if k not in ("password_hash", "pw_version")}

    def delete_user(self, user_id: str) -> bool:
        if user_id not in self.users:
            return False
        self.users[user_id]["is_deleted"] = True
        self.users[user_id]["deleted_at"] = datetime.utcnow().isoformat() + "Z"
        self.save()
        return True

    def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        user = self.users.get(user_id)
        if not user:
            return False
        pw_version = user.get("pw_version", "sha256")
        if not self._verify_password(old_password, user["password_hash"], pw_version):
            return False
        user["password_hash"] = self._hash_password(new_password)
        user["pw_version"] = "bcrypt"
        user["updated_at"] = datetime.utcnow().isoformat() + "Z"
        self.save()
        return True
