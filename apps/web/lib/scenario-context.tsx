"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as api from "./api-client";
import type { PlanningScenario } from "./types";

interface ScenarioContextValue {
  scenarios: PlanningScenario[];
  scenarioId: string | null;
  scenario: PlanningScenario | null;
  setScenarioId: (id: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [scenarios, setScenarios] = useState<PlanningScenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getScenarios()
      .then((list) => {
        if (cancelled) return;
        setScenarios(list);
        setScenarioId((current) => current ?? list[0]?.id ?? null);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load scenarios"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null;

  return (
    <ScenarioContext.Provider
      value={{ scenarios, scenarioId, scenario, setScenarioId, loading, error, reload: () => setReloadToken((t) => t + 1) }}
    >
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used within ScenarioProvider");
  return ctx;
}
