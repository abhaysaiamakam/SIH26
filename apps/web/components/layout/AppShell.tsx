"use client";

import { AuthProvider } from "../../lib/auth-context";
import { ScenarioProvider } from "../../lib/scenario-context";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ScenarioProvider>
        <div className="flex h-screen overflow-hidden bg-rail-bg text-slate-200">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </ScenarioProvider>
    </AuthProvider>
  );
}
