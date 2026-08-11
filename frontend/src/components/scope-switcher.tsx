"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Layers, ChevronsUpDown, Check, Globe } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Department {
  id: string;
  name: string;
}

interface ScopeOption {
  id: string;
  name: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function deptFetch(path: string): Promise<Response> {
  const token = getToken();
  return fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default function ScopeSwitcher({
  activeScope,
  onSwitch,
  isPrivileged,
}: {
  activeScope: string;
  onSwitch: (scope: string) => void;
  isPrivileged: boolean;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await deptFetch("/api/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments ?? []);
      }
    } catch {
      /* silent - scope switching degrades to General-only */
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount, same pattern as org-switcher.tsx's identical effect -
    // setDepartments only fires after the awaited response, not
    // synchronously during this effect's own execution.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // "General" is always available; admin/manager additionally get "All" (no
  // department filter) plus every department, not just their own.
  const options: ScopeOption[] = [
    { id: "general", name: "General" },
    ...(isPrivileged ? [{ id: "all", name: "All departments" }] : []),
    ...departments,
  ];

  // Nothing to switch between (no department assigned, not privileged) -
  // stay out of the way rather than showing a dead dropdown.
  if (!isPrivileged && departments.length === 0) return null;

  const active = options.find((o) => o.id === activeScope) ?? options[0];

  function switchScope(scopeId: string) {
    setOpen(false);
    if (scopeId !== activeScope) onSwitch(scopeId);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="btn-outline flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] active:scale-[0.97] transition-transform"
      >
        {active?.id === "general" ? (
          <Globe className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
        ) : (
          <Layers className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
        )}
        <span className="hidden sm:block max-w-[110px] truncate">{active?.name ?? "General"}</span>
        <ChevronsUpDown className="w-3 h-3 text-[var(--ink-soft)]" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 max-w-[80vw] card-bordered shadow-lg z-50 overflow-hidden org-switcher-enter">
          <div className="px-3 py-2 border-b border-[var(--line)]">
            <p className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wide">Knowledge scope</p>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => switchScope(opt.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="flex-1 min-w-0 text-left truncate">{opt.name}</span>
                {opt.id === active?.id && <Check className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
