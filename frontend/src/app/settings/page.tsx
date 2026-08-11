"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sun, Moon, Monitor, Check, KeyRound } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";
import { apiFetch } from "@/lib/api";
import { ToastBar, useToast } from "@/components/Toast";

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", description: "Paper background, graphite ink", icon: Sun },
  { value: "dark", label: "Dark", description: "Graphite surfaces, cyan accent", icon: Moon },
  { value: "system", label: "System", description: "Match your device setting", icon: Monitor },
];

export default function Settings() {
  const router = useRouter();
  const { preference, setPreference } = useTheme();
  const { toasts, toast, dismiss } = useToast();
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "" });
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    const stored = localStorage.getItem("user");
    if (stored) setCurrentUser(JSON.parse(stored));
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    setChangingPw(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ old_password: pwForm.oldPassword, new_password: pwForm.newPassword }),
      });
      if (res.ok) {
        toast("Password changed", "success");
        setPwForm({ oldPassword: "", newPassword: "" });
      } else {
        const err = await res.json();
        toast(err.detail || "Failed to change password", "error");
      }
    } catch {
      toast("Error changing password", "error");
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] page-enter">
      <ToastBar toasts={toasts} dismiss={dismiss} />
      <header className="border-b border-[var(--line)] px-6 py-4 sticky top-0 bg-[var(--paper)] z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Back to chat"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--ink-soft)]" />
          </button>
          <div className="flex items-center gap-2.5">
            <LogoMark size={24} />
            <h1 className="font-display text-xl font-bold text-[var(--ink)]">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <section className="card-bordered p-6">
          <h2 className="font-display text-sm font-bold text-[var(--ink)] mb-1">Appearance</h2>
          <p className="text-sm text-[var(--ink-soft)] mb-5">
            Choose how Iboro looks on this device.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const active = preference === value;
              return (
                <button
                  key={value}
                  onClick={() => setPreference(value)}
                  aria-pressed={active}
                  className={`relative text-left p-4 rounded-lg border transition-colors hover-lift ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {active && (
                    <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-[var(--accent-foreground)]" strokeWidth={3} />
                    </span>
                  )}
                  <Icon className={`w-5 h-5 mb-3 ${active ? "text-[var(--accent)]" : "text-[var(--ink-soft)]"}`} />
                  <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">{description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {currentUser && (
          <section className="card-bordered p-6">
            <h2 className="font-display text-sm font-bold text-[var(--ink)] mb-1">Account</h2>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-10 h-10 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center font-display font-bold text-sm text-[var(--ink)]">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{currentUser.username}</p>
                <span className="badge-outline mt-0.5 capitalize">{currentUser.role}</span>
              </div>
            </div>
          </section>
        )}

        <section className="card-bordered p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-[var(--ink-soft)]" />
            <h2 className="font-display text-sm font-bold text-[var(--ink)]">Security</h2>
          </div>
          <p className="text-sm text-[var(--ink-soft)] mb-5">Change your account password.</p>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="text-xs font-medium text-[var(--ink-soft)] mb-1 block">Current password</label>
              <input
                type="password"
                required
                value={pwForm.oldPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, oldPassword: e.target.value }))}
                className="input-bordered w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--ink-soft)] mb-1 block">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                className="input-bordered w-full px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-[var(--ink-soft)] mt-1">At least 8 characters.</p>
            </div>
            <button type="submit" disabled={changingPw} className="btn-accent px-4 py-2 text-sm">
              {changingPw ? "Changing…" : "Change password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
