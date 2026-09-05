"use client";

import { useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/Badge";
import type { Plan, PlanningRun, StrategyType } from "../../lib/types";

const STRATEGIES: { key: StrategyType; label: string }[] = [
  { key: "FIRST_FEASIBLE", label: "First Feasible" },
  { key: "PRIORITY_FIRST", label: "Priority First" },
  { key: "OPTIMIZED", label: "RAILOPT Optimized" },
];

interface StrategyResult {
  run: PlanningRun;
  plan: Plan | null;
}

export default function OptimizationPage() {
  const { scenario, scenarioId } = useScenario();
  const [results, setResults] = useState<Partial<Record<StrategyType, StrategyResult>>>({});
  const [running, setRunning] = useState<StrategyType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runStrategy(strategy: StrategyType) {
    if (!scenarioId) return;
    setRunning(strategy);
    setError(null);
    try {
      const run = await api.createPlanningRun(scenarioId, strategy);
      const finished = await api.pollPlanningRun(run.id);
      const plan = finished.resultPlanId ? await api.getPlan(finished.resultPlanId) : null;
      setResults((prev) => ({ ...prev, [strategy]: { run: finished, plan } }));
      if (finished.status === "FAILED") setError(`${strategy}: ${finished.errorMessage}`);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Run failed - sign in as a planner to run the optimizer");
    } finally {
      setRunning(null);
    }
  }

  async function decide(strategy: StrategyType, decision: "approve" | "reject") {
    const result = results[strategy];
    if (!result?.plan) return;
    setError(null);
    try {
      const updated = decision === "approve" ? await api.approvePlan(result.plan.id) : await api.rejectPlan(result.plan.id);
      const full = await api.getPlan(updated.id);
      setResults((prev) => ({ ...prev, [strategy]: { run: result.run, plan: full } }));
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : `Failed to ${decision} plan`);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Optimization</h1>
        {scenario && (
          <p className="text-sm text-slate-400">
            {scenario.name} · seed {scenario.seed} · config {scenario.configVersion}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {STRATEGIES.map((s) => (
          <button
            key={s.key}
            onClick={() => runStrategy(s.key)}
            disabled={running !== null}
            className="rounded border border-rail-border bg-rail-panel px-4 py-2 text-sm font-medium text-slate-200 hover:border-rail-accent disabled:opacity-50"
          >
            {running === s.key ? "Running..." : `RUN ${s.label.toUpperCase()}`}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="overflow-x-auto">
        <CardHeader title="Strategy Comparison" subtitle="All three run against the identical candidate set - see docs/OPTIMIZATION_MODEL.md" />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Strategy</th>
              <th className="px-3 py-2">Solver Status</th>
              <th className="px-3 py-2">Objective</th>
              <th className="px-3 py-2">Candidates Gen.</th>
              <th className="px-3 py-2">Candidates Rej.</th>
              <th className="px-3 py-2">Tasks Scheduled</th>
              <th className="px-3 py-2">Critical Scheduled</th>
              <th className="px-3 py-2">Blocks Used</th>
              <th className="px-3 py-2">Bundles</th>
              <th className="px-3 py-2">Train Delay (min)</th>
              <th className="px-3 py-2">Solve Time</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map(({ key, label }) => {
              const result = results[key];
              const revision = result?.plan?.revisions[0];
              const scheduled = revision?.tasks.filter((t) => t.scheduled) ?? [];
              const critical = scheduled.filter((t) => t.priorityBreakdown.assetCriticality >= 25); // proxy for CRITICAL asset points
              const bundles = revision?.blocks.filter((b) => b.isBundle) ?? [];
              const sim = revision?.simulationRuns[0];
              return (
                <tr key={key} className="border-b border-rail-border/60">
                  <td className="px-3 py-2 font-medium text-slate-100">{label}</td>
                  <td className="px-3 py-2">{result ? <StatusBadge value={result.run.status} /> : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{result?.run.objectiveValue?.toFixed(1) ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-400">{result?.run.candidateCount ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-400">{result?.run.rejectedCandidateCount ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{revision ? `${scheduled.length} / ${revision.tasks.length}` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{revision ? critical.length : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{revision?.blocks.length ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{revision ? bundles.length : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-200">{sim ? sim.totalDelayMinutes : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{result?.run.solveTimeMs !== undefined && result?.run.solveTimeMs !== null ? `${result.run.solveTimeMs}ms` : "—"}</td>
                  <td className="px-3 py-2">
                    {result?.plan?.status === "VALIDATED" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => decide(key, "approve")} className="rounded border border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-400 hover:bg-emerald-900/30">
                          Approve
                        </button>
                        <button onClick={() => decide(key, "reject")} className="rounded border border-red-700 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-900/30">
                          Reject
                        </button>
                      </div>
                    )}
                    {result?.plan?.status === "APPROVED" && <StatusBadge value="APPROVED" />}
                    {result?.plan?.status === "REJECTED" && <StatusBadge value="REJECTED" />}
                    {result?.plan?.status === "INVALID" && <StatusBadge value="INVALID" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs text-slate-500">
          &ldquo;SYNTHETIC SCENARIO RESULT&rdquo; - all numbers above come from an actual solver/greedy run against this session&apos;s synthetic
          data, never hardcoded.
        </p>
      </Card>
    </div>
  );
}
