import os
import socket
import sys
import time
import uuid
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# Checked before any other import in this file runs (rag_engine.py alone
# loads a multi-second embedding model) so an unlicensed or wrong-machine
# copy fails fast with a clear message instead of grinding through minutes
# of startup first. See license_guard.py for exactly what this does and
# does not protect against.
import license_guard

try:
    _license = license_guard.enforce()
except license_guard.LicenseError as e:
    print("=" * 70)
    print("LICENSE ERROR - this app cannot start.")
    print(str(e))
    print("=" * 70)
    sys.exit(1)

from rag_engine import RAGEngine, timing_logger
from conversation_store import ConversationStore
from user_store import UserStore
from org_store import OrgStore
from role_store import RoleStore
from department_store import DepartmentStore
from network_access_store import NetworkAccessStore
import threading
import json
import base64

os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = FastAPI()

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Documents live under DATA_DIR/<department>/ - "general" (company-wide,
# admin/manager upload only) plus one subdirectory per real department. This
# mirrors the department tag stored in each chunk's vector metadata, and the
# startup scan below (already recursive) needs no logic change to pick it up.
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
(DATA_DIR / "general").mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {
    ".pdf", ".txt", ".md", ".csv", ".docx", ".json", ".rtf", ".pptx",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp",
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "phi3.5:3.8b-mini-instruct-q4_K_M")

rag = RAGEngine()
conversation_store = ConversationStore()
user_store = UserStore()
org_store = OrgStore()
role_store = RoleStore()
department_store = DepartmentStore()
network_access_store = NetworkAccessStore()

# ── Network gateway (Caddy) allowlist sync ──────────────────────────────
# The public entry point for this app is the Caddy gateway (deploy/caddy/
# Caddyfile), not the backend/frontend dev servers directly. Caddy blocks
# any client IP that isn't on the allowlist below the router level, before
# the request ever reaches FastAPI or Next.js. Two things are always
# trusted: the IPs/CIDRs an admin adds in the dashboard (on-prem/proximity
# devices - office, home network), and the Tailscale CGNAT range (roaming
# devices - laptop at a coffee shop, phone on cellular). Tailscale already
# gates who's allowed onto the tailnet via its own admin console, so
# trusting that whole range here just means "if Tailscale let you in,
# Caddy will too" - no IP-chasing needed as those devices move networks.
TAILSCALE_CGNAT_RANGE = "100.64.0.0/10"
CADDY_CONFIG_PATH = (Path(__file__).parent / os.getenv("CADDY_CONFIG_PATH", "../deploy/caddy/Caddyfile")).resolve()
CADDY_ADMIN_URL = os.getenv("CADDY_ADMIN_URL", "http://localhost:2019")
CADDY_UPSTREAM_BACKEND = os.getenv("CADDY_UPSTREAM_BACKEND", "127.0.0.1:8000")
CADDY_UPSTREAM_FRONTEND = os.getenv("CADDY_UPSTREAM_FRONTEND", "127.0.0.1:3000")


GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", "8443"))


def _render_caddyfile() -> str:
    # 127.0.0.1/::1 are unconditional, not a fallback for an empty list -
    # they used to only apply if `trusted` was completely empty, but the
    # Tailscale range is always present so that branch could never actually
    # fire. Clearing every admin-added entry (as happened once) left only
    # the Tailscale range trusted, locking the admin out of their own
    # machine entirely. The server machine itself must always be able to
    # reach its own gateway, no matter what's in the allowlist.
    trusted = ["127.0.0.1", "::1", TAILSCALE_CGNAT_RANGE] + [e["ip"] for e in network_access_store.list_entries()]
    ip_list = " ".join(trusted)
    # tls internal: Caddy's own local CA, generated and kept entirely on
    # this machine - no ACME/Let's Encrypt, no domain, no internet
    # dependency, which is what makes real HTTPS possible while still
    # "running locally" per the brief. The tradeoff: only devices that
    # trust this machine's local CA see a clean padlock: this machine
    # itself (deploy/setup.sh runs `caddy trust` for that), other devices
    # get a one-time browser warning unless the CA cert is installed on
    # them too - see GUIDE.md.
    return f"""{{
\tauto_https off
}}

:{GATEWAY_PORT} {{
\ttls internal {{
\t\ton_demand
\t}}
\troute {{
\t\t@blocked not remote_ip {ip_list}
\t\trespond @blocked "Forbidden" 403

\t\thandle /api/* {{
\t\t\treverse_proxy {CADDY_UPSTREAM_BACKEND}
\t\t}}

\t\thandle {{
\t\t\treverse_proxy {CADDY_UPSTREAM_FRONTEND}
\t\t}}
\t}}
}}
"""


def get_lan_ip() -> str:
    """Best-effort LAN IP for this machine, for display in the admin dashboard.

    Doesn't actually send anything - connect() on a UDP socket just asks the
    OS to pick the local interface/address it would use to reach that
    destination, which is the standard no-dependency trick for this.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def sync_caddy_allowlist():
    """Regenerate the Caddyfile and hot-reload Caddy via its local admin API.

    Best-effort: if Caddy isn't running (e.g. local dev without the
    gateway), this silently no-ops rather than blocking the allowlist edit.
    """
    caddyfile = _render_caddyfile()
    try:
        CADDY_CONFIG_PATH.write_text(caddyfile)
    except Exception as e:
        print(f"Warning: could not write Caddyfile at {CADDY_CONFIG_PATH}: {e}")
        return
    try:
        import requests as req
        req.post(
            f"{CADDY_ADMIN_URL}/load",
            data=caddyfile.encode(),
            headers={"Content-Type": "text/caddyfile"},
            timeout=5,
        )
    except Exception as e:
        print(f"Warning: could not hot-reload Caddy at {CADDY_ADMIN_URL}: {e}")


sync_caddy_allowlist()


def _department_dir(department: str) -> Path:
    d = DATA_DIR / department
    d.mkdir(parents=True, exist_ok=True)
    return d


def _migrate_users_to_orgs():
    """One-time migration: give every legacy user an org derived from `company`."""
    changed = False
    for user in user_store.users.values():
        if user.get("is_deleted"):
            continue
        company = user.get("company", "Company")
        org = org_store.get_or_create_for_company(company, user["id"])
        if user["id"] not in org["members"]:
            role = "owner" if user.get("role") == "admin" else "member"
            org_store.add_member(org["id"], user["id"], role)
        if not user.get("active_org_id"):
            user["active_org_id"] = org["id"]
            changed = True
    if changed:
        user_store.save()


_migrate_users_to_orgs()


def get_current_user_id(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return user_store.decode_token(auth[7:])
    return None


def require_auth(request: Request) -> str:
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


def require_admin(request: Request) -> str:
    user_id = require_auth(request)
    user = user_store.get_user(user_id)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user_id


def require_admin_or_manager(request: Request) -> str:
    user_id = require_auth(request)
    user = user_store.get_user(user_id)
    if not user or user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admins and managers only")
    return user_id


def _can_upload_to(user: dict, department: str) -> bool:
    """admin/manager can upload anywhere; a department head can upload only
    to their own department (never to "general" - company-wide knowledge is
    admin/manager only, per the department scoping design)."""
    if user.get("role") in ("admin", "manager"):
        return True
    if department == department_store.GENERAL:
        return False
    dept = department_store.get_department(department)
    return bool(dept and dept.get("head_user_id") == user["id"])


def _can_use_scope(user: dict, scope: str) -> bool:
    """Which chat/document scope a user may query - enforced server-side so
    a regular user can't cross-department-query by editing the request.

    Same headship gap as _can_upload_to used to have (see list_departments):
    a department head isn't necessarily a member of the department they
    head, so department_id alone isn't enough - without the head_user_id
    check below, a head could upload to their department (that check was
    already headship-aware) but then couldn't chat with or even list what
    they'd just uploaded, since every read went through this function.
    """
    if user.get("role") in ("admin", "manager"):
        return True
    if scope == department_store.GENERAL:
        return True
    if user.get("department_id") == scope:
        return True
    dept = department_store.get_department(scope)
    return bool(dept and dept.get("head_user_id") == user["id"])


# Auto-index documents on startup (skips already-indexed files). Department
# is derived from the immediate subdirectory under DATA_DIR the file lives in.
def load_documents_async():
    if DATA_DIR.exists():
        for file_path in DATA_DIR.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                if file_path.stat().st_size < 100_000_000:
                    try:
                        department = file_path.parent.relative_to(DATA_DIR).parts[0] \
                            if file_path.parent != DATA_DIR else department_store.GENERAL
                        rag.add_document(str(file_path), department=department)
                    except Exception as e:
                        print(f"Failed to index {file_path.name}: {e}")
    rag.sweep_orphaned_chunks()


threading.Thread(target=load_documents_async, daemon=True).start()


# ── Pydantic models ────────────────────────────────────────────────────────

class HistoryTurn(BaseModel):
    role: str
    content: str


class QueryRequest(BaseModel):
    question: str
    history: Optional[List[HistoryTurn]] = None
    scope: str = "general"


class Message(BaseModel):
    role: str
    content: str
    timestamp: str
    sources: list = []


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"
    company: Optional[str] = None
    department_id: Optional[str] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    department_id: Optional[str] = None
    can_upload: Optional[bool] = None
    is_active: Optional[bool] = None


class CreateRoleRequest(BaseModel):
    name: str


class CreateNetworkAccessRequest(BaseModel):
    ip: str
    label: str = ""


class CreateDepartmentRequest(BaseModel):
    name: str


class UpdateDepartmentRequest(BaseModel):
    name: Optional[str] = None
    head_user_id: Optional[str] = None


# ── Auth endpoints ─────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"status": "RAG chatbot ready"}


@app.get("/api/license")
def license_info():
    # Company name only, never the license_id or signature - just enough
    # for the login/admin UI to show who this copy is licensed to.
    return {"company": _license.get("company")}


@app.get("/api/admin/gateway-certificate")
def download_gateway_certificate(http_request: Request):
    require_admin(http_request)
    # Caddy's own locally-generated root CA (see _render_caddyfile - "tls
    # internal"). Installing this on a device is what turns the one-time
    # browser warning into a real trusted padlock for every future visit -
    # distributed by the admin (AirDrop/email/Slack) since there's no
    # bootstrap-free way for a device to fetch it before it trusts anything
    # serving over this gateway in the first place.
    ca_path = Path.home() / "Library/Application Support/Caddy/pki/authorities/local/root.crt"
    if not ca_path.exists():
        # Non-macOS XDG default, in case this ever runs there.
        ca_path = Path.home() / ".local/share/caddy/pki/authorities/local/root.crt"
    if not ca_path.exists():
        raise HTTPException(status_code=404, detail="Certificate not found yet - make sure the gateway has started at least once.")
    return StreamingResponse(
        iter([ca_path.read_bytes()]),
        media_type="application/x-x509-ca-cert",
        headers={"Content-Disposition": "attachment; filename=iboro-gateway-ca.crt"},
    )


@app.post("/api/auth/login")
def login(request: LoginRequest):
    user = user_store.authenticate(request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"status": "success", "user": user}


@app.post("/api/auth/signup")
def signup(request: CreateUserRequest):
    # Self-signup must never be able to grant department membership - that
    # was previously accepted straight from the request body, so anyone who
    # could reach this endpoint could self-register into any department
    # (e.g. department_id: "sales") and immediately read that department's
    # confidential documents/chat, with no admin or department-head
    # approval at all. Department assignment is admin/manager-only, via
    # PATCH /api/admin/users/{username} - a fresh signup always starts with
    # no department, same as before this endpoint existed the exploit way.
    try:
        user = user_store.create_user(
            request.username,
            request.email,
            request.password,
            "user",
            request.company or "Default Company",
            None,
        )
        org = org_store.get_or_create_for_company(user["company"], user["id"])
        user = user_store.update_user(user["id"], {"active_org_id": org["id"]})
        token = user_store.create_access_token(user["id"])
        return {"status": "success", "user": {**user, "token": token}}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/logout")
def logout():
    return {"status": "success"}


@app.get("/api/auth/me")
def get_current_user(request: Request):
    user_id = require_auth(request)
    user = user_store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class AdminResetPasswordRequest(BaseModel):
    new_password: str


@app.post("/api/auth/change-password")
def change_password(request: ChangePasswordRequest, http_request: Request):
    user_id = require_auth(http_request)
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if not user_store.change_password(user_id, request.old_password, request.new_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    return {"status": "success"}


# ── User management ────────────────────────────────────────────────────────

@app.post("/api/admin/users")
def create_user(http_request: Request, request: CreateUserRequest):
    require_admin(http_request)
    if not role_store.role_exists(request.role):
        raise HTTPException(status_code=400, detail="Unknown role")
    department_id = request.department_id
    if department_id == department_store.GENERAL:
        department_id = None
    if department_id and not department_store.exists(department_id):
        raise HTTPException(status_code=400, detail="Unknown department")
    try:
        user = user_store.create_user(
            request.username, request.email, request.password,
            request.role, request.company or "Company", department_id,
        )
        org = org_store.get_or_create_for_company(user["company"], user["id"])
        org_role = "owner" if request.role == "admin" else "member"
        org_store.add_member(org["id"], user["id"], org_role)
        user = user_store.update_user(user["id"], {"active_org_id": org["id"]})
        return {"status": "success", "user": user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/admin/users")
def get_all_users(http_request: Request):
    require_admin(http_request)
    return user_store.get_all_users()


@app.get("/api/admin/company-users")
def get_company_users(http_request: Request, company: str = None):
    user_id = require_admin(http_request)
    if not company:
        company = user_store.get_user(user_id).get("company", "Company")
    return {"users": user_store.get_company_users(company)}


@app.patch("/api/admin/users/{username}")
def update_user(username: str, request: UpdateUserRequest, http_request: Request):
    require_admin(http_request)
    if not user_store.get_user(username):
        raise HTTPException(status_code=404, detail="User not found")

    # model_fields_set (not `is not None`) so an explicit
    # {"department_id": null} - clearing someone's department back to
    # General - is distinguishable from the field being omitted entirely.
    provided = request.model_fields_set
    updates = {}
    if "role" in provided:
        if not role_store.role_exists(request.role):
            raise HTTPException(status_code=400, detail="Unknown role")
        updates["role"] = request.role
    if "department_id" in provided:
        dept = None if request.department_id == department_store.GENERAL else request.department_id
        if dept and not department_store.exists(dept):
            raise HTTPException(status_code=400, detail="Unknown department")
        updates["department_id"] = dept
    if "can_upload" in provided:
        updates["can_upload"] = request.can_upload
    if "is_active" in provided:
        if username == "admin" and not request.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate the admin user")
        updates["is_active"] = request.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    user = user_store.update_user(username, updates)
    return {"status": "success", "user": user}


@app.post("/api/admin/users/{username}/reset-password")
def admin_reset_password(username: str, request: AdminResetPasswordRequest, http_request: Request):
    # Admin-only escape hatch for a user who forgot their password and can't
    # produce the old one /api/auth/change-password requires - this sets a
    # new one directly, no old password needed. It doesn't replace that
    # self-service flow, it's just the path for when it's unusable.
    require_admin(http_request)
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if not user_store.get_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    user_store.update_user(username, {"password": request.new_password})
    return {"status": "success"}


@app.delete("/api/admin/users/{username}")
def delete_user(username: str, http_request: Request):
    require_admin(http_request)
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    if not user_store.delete_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success"}


# ── Roles ─────────────────────────────────────────────────────────────────
# Custom roles are deliberately just labels (see role_store.py) - creating
# one doesn't require picking permissions, it automatically gets the same
# basic access as "user" everywhere in this file.

@app.get("/api/roles")
def list_roles(http_request: Request):
    require_admin(http_request)
    return {"roles": role_store.list_roles()}


@app.post("/api/roles")
def create_role(request: CreateRoleRequest, http_request: Request):
    require_admin(http_request)
    try:
        role = role_store.create_role(request.name)
        return {"status": "success", "role": role}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/roles/{role_id}")
def delete_role(role_id: str, http_request: Request):
    require_admin(http_request)
    try:
        role_store.delete_role(role_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Anyone holding this now-gone role falls back to "user".
    reassigned = 0
    for user in user_store.users.values():
        if user.get("role") == role_id:
            user["role"] = "user"
            reassigned += 1
    if reassigned:
        user_store.save()
    return {"status": "success", "reassigned_users": reassigned}


# ── Departments ──────────────────────────────────────────────────────────
# "general" is a fixed pseudo-department (company-wide knowledge, uploaded
# by admin/manager only) and never appears in this list - it isn't a real
# stored record, just the sentinel value used in document/chat scope.

@app.get("/api/departments")
def list_departments(http_request: Request):
    user_id = require_auth(http_request)
    user = user_store.get_user(user_id)
    all_departments = department_store.list_departments()
    if user.get("role") in ("admin", "manager"):
        return {"departments": all_departments}
    # Regular users only see their own department (if any) plus any
    # department they've been made head of - a head isn't necessarily a
    # member of the department they were assigned to lead, so both checks
    # are needed or they'd never see (or be able to upload to) it.
    own = [
        d for d in all_departments
        if d["id"] == user.get("department_id") or d.get("head_user_id") == user_id
    ]
    return {"departments": own}


@app.post("/api/departments")
def create_department(request: CreateDepartmentRequest, http_request: Request):
    require_admin_or_manager(http_request)
    try:
        department = department_store.create_department(request.name)
        return {"status": "success", "department": department}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/departments/{department_id}")
def update_department(department_id: str, request: UpdateDepartmentRequest, http_request: Request):
    require_admin_or_manager(http_request)
    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.head_user_id is not None:
        head_id = request.head_user_id or None
        if head_id and not user_store.get_user(head_id):
            raise HTTPException(status_code=400, detail="Unknown user")
        updates["head_user_id"] = head_id
    try:
        department = department_store.update_department(department_id, updates)
        return {"status": "success", "department": department}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/departments/{department_id}")
def delete_department(department_id: str, http_request: Request):
    require_admin_or_manager(http_request)
    if not department_store.exists(department_id) or department_id == department_store.GENERAL:
        raise HTTPException(status_code=404, detail="Department not found")

    # Cascade: remove its documents (vector chunks + files), unassign it
    # from any user, then delete the department record itself.
    deleted_chunks = rag.delete_department_documents(department_id)
    dept_dir = DATA_DIR / department_id
    if dept_dir.exists():
        for f in dept_dir.iterdir():
            if f.is_file():
                f.unlink()
        dept_dir.rmdir()

    reassigned = 0
    for user in user_store.users.values():
        if user.get("department_id") == department_id:
            user["department_id"] = None
            reassigned += 1
    if reassigned:
        user_store.save()

    department_store.delete_department(department_id)
    return {"status": "success", "deleted_chunks": deleted_chunks, "reassigned_users": reassigned}


# ── Network access (Caddy gateway allowlist) ─────────────────────────────

@app.get("/api/admin/network-access")
def list_network_access(http_request: Request):
    require_admin(http_request)
    return {
        "entries": network_access_store.list_entries(),
        "tailscale_range": TAILSCALE_CGNAT_RANGE,
        "server_ip": get_lan_ip(),
        "gateway_port": GATEWAY_PORT,
        "gateway_scheme": "https",
    }


@app.post("/api/admin/network-access")
def create_network_access(request: CreateNetworkAccessRequest, http_request: Request):
    require_admin(http_request)
    try:
        entry = network_access_store.add_entry(request.ip, request.label)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    sync_caddy_allowlist()
    return {"status": "success", "entry": entry}


@app.delete("/api/admin/network-access/{entry_id}")
def delete_network_access(entry_id: str, http_request: Request):
    require_admin(http_request)
    try:
        entry = network_access_store.delete_entry(entry_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    sync_caddy_allowlist()
    return {"status": "success", "entry": entry}


# ── Organizations (multi-account / workspace switching) ─────────────────────

class CreateOrgRequest(BaseModel):
    name: str


class InviteRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: Optional[str] = None
    role: str = "member"


@app.get("/api/orgs")
def list_orgs(request: Request):
    user_id = require_auth(request)
    return {"orgs": org_store.user_orgs(user_id)}


@app.post("/api/orgs")
def create_org(request: CreateOrgRequest, http_request: Request):
    user_id = require_auth(http_request)
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Organization name required")
    org = org_store.create_org(request.name.strip(), user_id)
    user_store.update_user(user_id, {"active_org_id": org["id"]})
    return {"status": "success", "org": org}


@app.post("/api/orgs/{org_id}/switch")
def switch_org(org_id: str, http_request: Request):
    user_id = require_auth(http_request)
    if not org_store.get_role(org_id, user_id):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    user = user_store.update_user(user_id, {"active_org_id": org_id})
    return {"status": "success", "user": user}


@app.get("/api/orgs/{org_id}/members")
def get_org_members(org_id: str, http_request: Request):
    user_id = require_auth(http_request)
    if not org_store.get_role(org_id, user_id):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    members = org_store.members(org_id)
    for m in members:
        u = user_store.get_user(m["user_id"])
        m["username"] = u["username"] if u else m["user_id"]
        m["email"] = u.get("email") if u else None
    return {"members": members}


@app.post("/api/orgs/{org_id}/invite")
def invite_to_org(org_id: str, request: InviteRequest, http_request: Request):
    user_id = require_auth(http_request)
    role = org_store.get_role(org_id, user_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    existing = user_store.get_user(request.username)
    if existing:
        org_store.add_member(org_id, request.username, request.role)
        return {"status": "success", "user": existing}

    if not request.email or not request.password:
        raise HTTPException(status_code=400, detail="email and password required to create a new user")
    org = org_store.get_org(org_id)
    new_user = user_store.create_user(
        request.username, request.email, request.password,
        "user", org["name"] if org else "Company",
    )
    org_store.add_member(org_id, request.username, request.role)
    user_store.update_user(request.username, {"active_org_id": org_id})
    return {"status": "success", "user": new_user}


@app.delete("/api/orgs/{org_id}/members/{member_id}")
def remove_org_member(org_id: str, member_id: str, http_request: Request):
    user_id = require_auth(http_request)
    role = org_store.get_role(org_id, user_id)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")
    try:
        if not org_store.remove_member(org_id, member_id):
            raise HTTPException(status_code=404, detail="Member not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success"}


# ── Documents ──────────────────────────────────────────────────────────────

def _format_size(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


@app.get("/api/documents")
def get_documents(request: Request, department: Optional[str] = None):
    user_id = require_auth(request)
    user = user_store.get_user(user_id)
    is_privileged = user.get("role") in ("admin", "manager")

    if department:
        if not is_privileged and not _can_use_scope(user, department):
            raise HTTPException(status_code=403, detail="Not authorized for this department")
        scopes = [department]
    elif is_privileged:
        scopes = [department_store.GENERAL] + [d["id"] for d in department_store.list_departments()]
    else:
        scopes = [department_store.GENERAL]
        if user.get("department_id"):
            scopes.append(user["department_id"])

    try:
        documents = []
        for scope in scopes:
            scope_dir = DATA_DIR / scope
            if not scope_dir.exists():
                continue
            for file_path in scope_dir.iterdir():
                if file_path.is_file() and file_path.name != ".DS_Store":
                    size = file_path.stat().st_size
                    documents.append({
                        "name": file_path.name,
                        "department": scope,
                        "size": _format_size(size),
                        "size_bytes": size,
                        "uploaded_at": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                    })
        documents.sort(key=lambda x: x["uploaded_at"], reverse=True)
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{document_name}")
def delete_document(document_name: str, http_request: Request, department: str = department_store.GENERAL):
    user_id = require_auth(http_request)
    user = user_store.get_user(user_id)
    if not user or user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Only admins and managers can delete documents")

    scope_dir = DATA_DIR / department
    file_path = scope_dir / document_name
    if not file_path.resolve().is_relative_to(DATA_DIR.resolve()):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    # The file is what the admin explicitly asked to remove, so it comes off
    # disk regardless - but a failed or no-op vector cleanup used to be
    # silently swallowed here, which is exactly how a chunk goes orphaned
    # with nothing pointing at it afterward (see sweep_orphaned_chunks).
    # Surfacing it doesn't block the delete, just makes the failure visible
    # instead of invisible.
    chunks_cleaned = False
    try:
        chunks_cleaned = rag.delete_document(document_name, department=department)
        if not chunks_cleaned:
            print(f"Warning: no vector DB chunks matched for deletion: {document_name} (department={department})")
    except Exception as e:
        print(f"Warning: vector DB delete failed for {document_name}: {e}")

    file_path.unlink()
    return {"status": "success", "name": document_name, "chunks_cleaned": chunks_cleaned}


@app.get("/api/status")
def get_status():
    return {"status": "running", "timestamp": datetime.utcnow().isoformat() + "Z"}


# ── Chat endpoints ─────────────────────────────────────────────────────────

@app.post("/api/chat")
def chat(request: QueryRequest, http_request: Request):
    user_id = require_auth(http_request)
    user = user_store.get_user(user_id)
    scope = request.scope or department_store.GENERAL
    if not _can_use_scope(user, scope):
        raise HTTPException(status_code=403, detail="Not authorized for this scope")
    if not request.question.strip():
        return {"messages": []}
    t0 = time.perf_counter()
    department_filter = None if scope == "all" else scope
    result = rag.query_text(request.question.strip(), department=department_filter)
    timing_logger.info(f"[-] chat_endpoint.query_text_total: {(time.perf_counter() - t0) * 1000:.1f}ms")
    now = datetime.utcnow().isoformat() + "Z"
    return {
        "messages": [
            {"role": "user", "content": request.question, "timestamp": now},
            {"role": "assistant", "content": result["answer"], "timestamp": now, "sources": result["sources"]},
        ]
    }


@app.post("/api/chat/stream")
async def chat_stream(request: QueryRequest, http_request: Request):
    user_id = get_current_user_id(http_request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = user_store.get_user(user_id)
    scope = request.scope or department_store.GENERAL
    if not user or not _can_use_scope(user, scope):
        # Enforced here, not just hidden in the UI - a regular user can't
        # cross-department-query by editing the request body.
        raise HTTPException(status_code=403, detail="Not authorized for this scope")

    if not request.question.strip():
        async def _empty():
            yield json.dumps({"type": "end", "data": ""}) + "\n"
        return StreamingResponse(_empty(), media_type="application/x-ndjson")

    async def response_generator():
        request_id = uuid.uuid4().hex[:8]
        t_start = time.perf_counter()
        stage_times = {}
        try:
            question = request.question.strip()
            timing_logger.info(f"[{request_id}] chat_stream.start: user={user_id}, question_chars={len(question)}")

            # "all" (admin/manager only, enforced above) searches every
            # department at once; any other scope hard-filters to just that
            # one department's chunks.
            department_filter = None if scope == "all" else scope

            t0 = time.perf_counter()
            docs = rag.retrieve(question, department=department_filter, request_id=request_id)
            stage_times["retrieval"] = (time.perf_counter() - t0) * 1000
            timing_logger.info(f"[{request_id}] chat_stream.retrieval: {stage_times['retrieval']:.1f}ms ({len(docs)} docs)")

            t0 = time.perf_counter()
            if not docs:
                context = "No relevant documents."
            else:
                context = "\n\n".join(f"[{i+1}]: {d.page_content}" for i, d in enumerate(docs))

            sources = [
                {
                    "text": d.page_content[:300],
                    "source": Path(d.metadata.get("source", "unknown")).name,
                    "page": d.metadata.get("page", 0) + 1 if d.metadata.get("page") is not None else 1,
                }
                for d in docs
            ]
            stage_times["document_processing"] = (time.perf_counter() - t0) * 1000
            timing_logger.info(f"[{request_id}] chat_stream.document_processing: {stage_times['document_processing']:.1f}ms")

            t0 = time.perf_counter()
            history_block = ""
            if request.history:
                # Capped at 4 turns (was 8) - halves the history token cost.
                # Still enough for immediate follow-ups ("is this all?", "list
                # all") to resolve what they refer to.
                recent = request.history[-4:]
                lines = "\n".join(f"{t.role}: {t.content}" for t in recent)
                history_block = f"Recent conversation:\n{lines}\n\n"

            if department_filter is None:
                doc_dirs = [department_store.GENERAL] + [d["id"] for d in department_store.list_departments()]
            else:
                doc_dirs = [department_filter]
            available_docs = sorted(
                f.name for d in doc_dirs for f in (DATA_DIR / d).glob("*")
                if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
            )
            docs_block = ", ".join(available_docs) if available_docs else "none"

            prompt = f"""You are the knowledge assistant for this organization. You answer questions using only the documents indexed below - you are not a general chatbot and you do not use outside knowledge. Your tone is professional, direct, and confident - never apologetic, never hedging with phrases like "it seems" or "I think" when the context clearly states something.

Indexed documents (use verbatim if asked what files you have - don't confuse with content): {docs_block}

{history_block}Retrieved context (may or may not be relevant):
{context}

How to answer, in priority order:
1. Greeting, small talk, or a vague/open-ended question that isn't really asking for document content (e.g. "what do you know", "what can you do", "help") -> respond naturally and briefly, ignore the context below. Don't force a document-grounded answer out of a question that isn't really asking for one.
2. Asked what documents/files exist (e.g. "what documents do you have", "what files are there", "what do you have access to") -> list the file names from the document list above, in a sentence or short list. Ignore the retrieved context entirely for this case - it is irrelevant to what's being asked and must not be cited.
   Example - question "what documents do you have?" with indexed documents "report.pdf, notes.txt" -> correct answer: "I have access to 2 documents: **report.pdf** and **notes.txt**." Wrong answer (never do this): "[1] [2]"
3. Refers back to the conversation ("is this all?", "list all", "go on") -> resolve it using Recent conversation above.
4. Otherwise -> answer using ONLY the retrieved context, in real sentences. If the context is empty, unrelated to the question, or doesn't actually cover it, say so plainly in one sentence - never guess, never fill gaps with outside knowledge, and never cite a source that isn't actually relevant just because it was retrieved.

Formatting rules:
- Every answer must be made of real sentences explaining the answer - never respond with bare citation markers like "[1] [2]" and nothing else. A citation always comes immediately after the sentence it supports, never standing alone.
- Lead with the direct answer in the first sentence - no preamble like "Based on the context" or "According to the documents".
- Use a numbered or bulleted list whenever the answer has more than one distinct point, step, or item - not a single dense paragraph.
- Bold key terms, names, and figures the user is likely scanning for.
- Cite the source number in brackets (e.g. [1]) right after the fact it supports, whenever you use the context - but only as a small addition to real sentences, never as a substitute for them.
- Finish every thought - never trail off or cut a sentence short.

Current question: {question}
Answer:"""
            stage_times["prompt_construction"] = (time.perf_counter() - t0) * 1000
            timing_logger.info(
                f"[{request_id}] chat_stream.prompt_construction: {stage_times['prompt_construction']:.1f}ms "
                f"(prompt_chars={len(prompt)})"
            )

            now = datetime.utcnow().isoformat() + "Z"

            t0 = time.perf_counter()
            async for token in rag.generate_stream(prompt, request_id=request_id):
                yield json.dumps({"type": "assistant_chunk", "data": token}) + "\n"
            stage_times["model_inference"] = (time.perf_counter() - t0) * 1000

            if sources:
                yield json.dumps({"type": "sources", "data": sources}) + "\n"
            yield json.dumps({"type": "end", "data": now}) + "\n"

            total_ms = (time.perf_counter() - t_start) * 1000
            breakdown = ", ".join(f"{k}={v:.1f}ms" for k, v in stage_times.items())
            timing_logger.info(f"[{request_id}] chat_stream.TOTAL: {total_ms:.1f}ms ({breakdown})")

        except Exception as e:
            total_ms = (time.perf_counter() - t_start) * 1000
            timing_logger.info(f"[{request_id}] chat_stream.FAILED after {total_ms:.1f}ms: {e}")
            yield json.dumps({"type": "error", "data": str(e)}) + "\n"

    return StreamingResponse(response_generator(), media_type="application/x-ndjson")


@app.post("/api/upload")
async def upload_document(
    http_request: Request,
    file: UploadFile = File(...),
    department: str = Form(department_store.GENERAL),
):
    user_id = require_auth(http_request)
    user = user_store.get_user(user_id)
    if not department_store.exists(department):
        raise HTTPException(status_code=400, detail="Unknown department")
    # Department-scoped now: admin/manager upload anywhere, a department
    # head only to their own department. The old flat `can_upload` flag has
    # no department awareness, so it no longer factors in here.
    if not user or not _can_upload_to(user, department):
        raise HTTPException(status_code=403, detail="You don't have upload permissions for this department")

    safe_name = Path(file.filename).name  # strip any directory components
    ext = Path(safe_name).suffix.lower()
    if not safe_name or ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    scope_dir = _department_dir(department)
    file_path = scope_dir / safe_name
    if not file_path.resolve().is_relative_to(DATA_DIR.resolve()):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Stream-read with a running total instead of file.read() then checking
    # afterward - the old order buffered the entire upload into memory
    # before the size check ever ran, so an oversized upload (deliberate or
    # not) could exhaust memory before being rejected. This aborts as soon
    # as the limit is crossed, never holding more than one chunk over it.
    chunk_size = 1024 * 1024
    content = bytearray()
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024*1024)}MB limit")
    content = bytes(content)

    try:
        file_path.write_bytes(content)
        num_chunks = rag.add_document(str(file_path), department=department)
        if num_chunks == 0:
            raise Exception("Document produced no indexable content")
        return {"message": f"'{safe_name}' uploaded and indexed ({num_chunks} chunks)", "chunks": num_chunks, "filename": safe_name, "department": department}
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


@app.post("/vision")
async def vision(http_request: Request, question: str = Form(default="Describe this image in detail."), image: UploadFile = File(...)):
    require_auth(http_request)
    try:
        import requests as req
        img_bytes = await image.read()
        b64 = base64.b64encode(img_bytes).decode()
        resp = req.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": question,
                "images": [b64],
                "stream": False,
                "options": {
                    "num_ctx": 2048,
                    "num_predict": 80,
                    "temperature": 0.1,
                    "top_p": 0.3,           # Down from 0.5 - less computation
                    "top_k": 10,            # Down from 20 - faster sampling
                    "repeat_penalty": 1.2,
                },
            },
            timeout=120,
        )
        resp.raise_for_status()
        return {"answer": resp.json().get("response", "").strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision processing failed: {e}")



# ── Conversation endpoints ─────────────────────────────────────────────────

@app.get("/api/conversations")
def get_all_conversations(request: Request):
    user_id = require_auth(request)
    include_deleted = request.query_params.get("include_deleted", "false").lower() == "true"
    user = user_store.get_user(user_id)
    if user and user.get("role") in ("admin", "manager") and include_deleted:
        conv_list = list(conversation_store.get_all_conversations().values())
    else:
        conv_list = list(conversation_store.get_user_conversations(user_id, include_deleted).values())
    conv_list.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return conv_list


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str, request: Request):
    user_id = require_auth(request)
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user = user_store.get_user(user_id)
    if conv.get("user_id") != user_id and (not user or user.get("role") not in ("admin", "manager")):
        raise HTTPException(status_code=403, detail="Not authorized")
    return conv


@app.post("/api/conversations")
def create_conversation(request: Request, data: dict):
    user_id = require_auth(request)
    return conversation_store.create_conversation(
        data.get("id"), data.get("title", "New Conversation"), user_id,
        data.get("scope", department_store.GENERAL),
    )


@app.post("/api/conversations/{conversation_id}/messages")
def add_message(conversation_id: str, request: Request, message: Message):
    user_id = require_auth(request)
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user = user_store.get_user(user_id)
    if conv.get("user_id") != user_id and (not user or user.get("role") not in ("admin", "manager")):
        raise HTTPException(status_code=403, detail="Not authorized")
    conversation_store.add_message(conversation_id, {
        "id": message.role + "_" + datetime.utcnow().isoformat(),
        "role": message.role,
        "content": message.content,
        "timestamp": message.timestamp,
        "sources": message.sources,
    })
    return {"status": "ok"}


@app.put("/api/conversations/{conversation_id}/title")
def update_title(conversation_id: str, request: Request, data: dict):
    user_id = require_auth(request)
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user = user_store.get_user(user_id)
    if conv.get("user_id") != user_id and (not user or user.get("role") not in ("admin", "manager")):
        raise HTTPException(status_code=403, detail="Not authorized")
    title = data.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="Title required")
    conversation_store.update_conversation_title(conversation_id, title)
    return {"status": "ok"}


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, request: Request):
    user_id = require_auth(request)
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user = user_store.get_user(user_id)
    if conv.get("user_id") != user_id and (not user or user.get("role") not in ("admin", "manager")):
        raise HTTPException(status_code=403, detail="Not authorized")
    conversation_store.delete_conversation(conversation_id)
    return {"status": "ok"}


@app.get("/api/admin/users/{user_id}/conversations")
def get_user_conversations_admin(user_id: str, http_request: Request, include_deleted: str = "false"):
    require_admin_or_manager(http_request)
    if not user_store.get_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    convs = conversation_store.get_user_conversations(user_id, include_deleted.lower() == "true")
    conv_list = sorted(convs.values(), key=lambda x: x.get("createdAt", ""), reverse=True)
    return conv_list


if __name__ == "__main__":
    # reload=True is a dev convenience and dangerous in production here:
    # uvicorn's file watcher covers the whole backend/ tree by default,
    # including chroma_db/ (rewritten on every query) and data/ (every
    # upload) - either one can trigger a mid-request restart that kills an
    # in-flight streaming chat response, which looks exactly like the app
    # "not responding". Off by default; set DEV_RELOAD=1 for local dev.
    dev_reload = os.getenv("DEV_RELOAD", "0") == "1"
    # 127.0.0.1, not 0.0.0.0: the Caddy gateway (deploy/caddy/Caddyfile) is
    # meant to be the only network-reachable entry point, enforcing the
    # Network Access allowlist before anything reaches this app. Binding
    # the backend to all interfaces let any device on the LAN or Tailscale
    # network hit the API directly on :8000, completely bypassing that
    # allowlist - Caddy proxies to 127.0.0.1:8000, which still works
    # identically since they're on the same machine. Override via
    # BACKEND_HOST only if you specifically need direct LAN access without
    # going through the gateway (not recommended).
    backend_host = os.getenv("BACKEND_HOST", "127.0.0.1")
    uvicorn.run("app:app", host=backend_host, port=8000, reload=dev_reload)