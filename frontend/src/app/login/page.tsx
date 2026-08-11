"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LoaderRing } from "@/components/Preloader";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [licensedCompany, setLicensedCompany] = useState("");

  useEffect(() => {
    fetch(`${API}/api/license`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.company && setLicensedCompany(d.company))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      router.replace("/chat");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid credentials");

      const { token, ...user } = data.user;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      router.replace("/chat");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Request timed out - is the server running?");
      } else {
        setError((err as Error).message || "Login failed");
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm auth-card-enter">
        {/* Card */}
        <div className="card-bordered p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="logo-enter mb-3">
              <Logo size={36} />
            </div>
            <p className="text-sm text-[var(--ink-soft)] mt-1.5">Private, on-premise document search &amp; chat</p>
            {licensedCompany && (
              <p className="text-xs text-[var(--ink-soft)] mt-1 opacity-70">Licensed to {licensedCompany}</p>
            )}
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 border border-[var(--danger-border)] bg-[var(--danger-bg)] rounded text-sm text-[var(--danger-text)] message-enter">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--ink-soft)] mb-1.5" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="your username"
                className="input-bordered w-full px-3.5 py-2.5 text-sm disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--ink-soft)] mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className="input-bordered w-full px-3.5 py-2.5 text-sm disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="btn-accent w-full mt-2 py-2.5 px-4 text-sm flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoaderRing size={16} tone="mono" />
                  Signing in…
                </span>
              ) : (
                <>
                  Sign in <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-soft)] mt-6">
          No account?{" "}
          <button
            onClick={() => router.push("/register")}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Register
          </button>
        </p>
      </div>
    </div>
  );
}
