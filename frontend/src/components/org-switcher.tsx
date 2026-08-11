"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Building2, ChevronsUpDown, Check, Plus, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Org {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plan?: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function orgFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
}

export default function OrgSwitcher({ activeOrgId }: { activeOrgId?: string }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await orgFetch("/api/orgs");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.orgs ?? []);
      }
    } catch {
      /* silent - org switching is a progressive enhancement */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  async function switchOrg(orgId: string) {
    if (orgId === active?.id || busy) return;
    setBusy(true);
    try {
      const res = await orgFetch(`/api/orgs/${orgId}/switch`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function createOrg() {
    if (!newOrgName.trim() || busy) return;
    setBusy(true);
    try {
      const res = await orgFetch("/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (orgs.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="btn-outline flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] active:scale-[0.97] transition-transform"
      >
        <div className="w-5 h-5 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-display font-bold flex-shrink-0">
          {active ? initials(active.name) : <Building2 className="w-3 h-3" />}
        </div>
        <span className="hidden sm:block max-w-[110px] truncate">{active?.name ?? "Workspace"}</span>
        <ChevronsUpDown className="w-3 h-3 text-[var(--ink-soft)]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 max-w-[80vw] card-bordered shadow-lg z-50 overflow-hidden org-switcher-enter">
          <div className="px-3 py-2 border-b border-[var(--line)]">
            <p className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wide">Workspaces</p>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                disabled={busy}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
              >
                <div className="w-6 h-6 border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center text-[10px] font-display font-bold flex-shrink-0">
                  {initials(org.name)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate font-medium">{org.name}</p>
                  <p className="text-[11px] text-[var(--ink-soft)] capitalize">{org.role}</p>
                </div>
                {org.id === active?.id && <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--line)] p-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createOrg()}
                  placeholder="Organization name"
                  className="input-bordered flex-1 text-xs px-2.5 py-1.5"
                />
                <button
                  onClick={createOrg}
                  disabled={busy || !newOrgName.trim()}
                  className="btn-accent p-1.5 disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setCreating(false); setNewOrgName(""); }}
                  className="p-1.5 rounded text-[var(--ink-soft)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:bg-[var(--surface-2)] rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Create organization
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
