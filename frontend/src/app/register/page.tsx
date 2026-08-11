"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { LoaderRing } from "@/components/Preloader";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "", company: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      router.replace("/chat");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");

    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          role: "user",
          company: form.company.trim() || "Default Company",
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      const { token, ...user } = data.user;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="block text-sm text-[var(--ink-soft)] mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        disabled={loading}
        placeholder={placeholder}
        className="input-bordered w-full px-3.5 py-2.5 text-sm disabled:opacity-50"
      />
    </div>
  );

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm auth-card-enter">
        <div className="card-bordered p-8">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="logo-enter mb-3">
              <LogoMark size={36} />
            </div>
            <h1 className="font-display text-2xl font-bold text-[var(--ink)] tracking-tight">Create your account</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-1.5">Set up your team&apos;s workspace</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 border border-[var(--danger-border)] bg-[var(--danger-bg)] rounded text-sm text-[var(--danger-text)] message-enter">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {field("company", "Organization", "text", "e.g. Acme Inc.")}
            {field("username", "Username", "text", "choose a username")}
            {field("email", "Email", "email", "your@email.com")}
            {field("password", "Password", "password", "at least 6 characters")}
            {field("confirmPassword", "Confirm password", "password", "repeat your password")}

            <p className="text-xs text-[var(--ink-soft)]">
              You&apos;ll get General access to start - an admin can assign you to a specific department afterward.
            </p>

            <button
              type="submit"
              disabled={loading || !form.username.trim() || !form.email.trim() || !form.password}
              className="btn-accent w-full mt-2 py-2.5 px-4 text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoaderRing size={16} tone="mono" />
                  Creating account…
                </span>
              ) : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--ink-soft)] mt-6">
          Already have an account?{" "}
          <button onClick={() => router.push("/login")} className="font-medium text-[var(--accent)] hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
