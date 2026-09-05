"use client";

import { useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { useScenario } from "../../lib/scenario-context";
import { LoginPanel } from "./LoginPanel";

export function TopBar() {
  const { user, logout } = useAuth();
  const { scenarios, scenarioId, setScenarioId, loading } = useScenario();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-rail-border bg-rail-panel px-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-400">Scenario</span>
        <select
          className="rounded border border-rail-border bg-rail-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-rail-accent"
          value={scenarioId ?? ""}
          onChange={(e) => setScenarioId(e.target.value)}
          disabled={loading || scenarios.length === 0}
        >
          {scenarios.length === 0 && <option>No scenario generated - run the seed script</option>}
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (seed {s.seed})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-200">{user.name}</p>
              <p className="text-[10px] text-slate-500">{user.roles.join(", ")}</p>
            </div>
            <button onClick={logout} className="rounded border border-rail-border px-2.5 py-1 text-xs text-slate-300 hover:border-red-600 hover:text-red-400">
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="rounded bg-rail-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
          >
            Sign in
          </button>
        )}
      </div>

      {showLogin && <LoginPanel onClose={() => setShowLogin(false)} />}
    </header>
  );
}
