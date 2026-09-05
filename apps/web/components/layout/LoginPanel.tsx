"use client";

import { useState } from "react";
import { useAuth } from "../../lib/auth-context";

const DEMO_ACCOUNTS = [
  { label: "Divisional Planner", email: "div.planner@railopt.demo" },
  { label: "Control Operator", email: "control.operator@railopt.demo" },
  { label: "Management", email: "management@railopt.demo" },
  { label: "Admin", email: "admin@railopt.demo" },
];

export function LoginPanel({ onClose }: { onClose: () => void }) {
  const { login, error, loading } = useAuth();
  const [email, setEmail] = useState("div.planner@railopt.demo");
  const [password, setPassword] = useState("railopt-demo-2026");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      onClose();
    } catch {
      // error surfaced via auth context
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-rail-border bg-rail-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-slate-100">Sign in</h2>
        <p className="mt-1 text-xs text-slate-400">Local seeded demo accounts - see docs/API.md.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-400">Email</label>
            <input
              className="mt-1 w-full rounded border border-rail-border bg-rail-bg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-rail-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400">Password</label>
            <input
              type="password"
              className="mt-1 w-full rounded border border-rail-border bg-rail-bg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-rail-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-rail-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="mt-4 border-t border-rail-border pt-3">
          <p className="text-xs text-slate-500">Quick pick (password: railopt-demo-2026):</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                onClick={() => setEmail(a.email)}
                className="rounded border border-rail-border px-2 py-1 text-[11px] text-slate-300 hover:border-rail-accent hover:text-white"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
