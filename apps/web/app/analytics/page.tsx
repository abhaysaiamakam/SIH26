"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import type { StrategyAnalytics, StrategyType } from "../../lib/types";

const STRATEGIES: StrategyType[] = ["FIRST_FEASIBLE", "PRIORITY_FIRST", "OPTIMIZED"];
const STRATEGY_COLOR: Record<StrategyType, string> = { FIRST_FEASIBLE: "#64748b", PRIORITY_FIRST: "#d97706", OPTIMIZED: "#2f81f7" };

export default function AnalyticsPage() {
  const { scenarioId } = useScenario();
  const [byStrategy, setByStrategy] = useState<Partial<Record<StrategyType, StrategyAnalytics>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    api.getAnalytics(scenarioId).then((res) => {
      const map: Partial<Record<StrategyType, StrategyAnalytics>> = {};
      for (const entry of res.strategies) map[entry.strategy] = entry;
      setByStrategy(map);
      setLoading(false);
    });
  }, [scenarioId]);

  const maxObjective = Math.max(1, ...STRATEGIES.map((s) => byStrategy[s]?.objectiveValue ?? 0));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Analytics</h1>
        <p className="text-sm text-slate-400">
          Server-side comparison across the most recent validated plan per strategy for this scenario -{" "}
          <span className="font-semibold text-slate-300">SYNTHETIC SCENARIO RESULT</span>, not a real-world performance claim.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : Object.keys(byStrategy).length === 0 ? (
        <Card className="p-4 text-sm text-slate-500">
          No validated plans yet for this scenario. Run each strategy from the Optimization page first.
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Objective Value" subtitle="Higher is better - see docs/OPTIMIZATION_MODEL.md for the objective function" />
            <div className="space-y-3 p-4">
              {STRATEGIES.map((s) => {
                const m = byStrategy[s];
                const value = m?.objectiveValue ?? 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-slate-400">{s.replace(/_/g, " ")}</span>
                    <div className="h-4 flex-1 rounded bg-rail-bg">
                      <div className="h-4 rounded" style={{ width: `${(value / maxObjective) * 100}%`, background: STRATEGY_COLOR[s] }} />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-300">{m ? value.toFixed(0) : "—"}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-x-auto">
            <CardHeader title="Detailed Comparison" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Metric</th>
                  {STRATEGIES.map((s) => (
                    <th key={s} className="px-3 py-2">
                      {s.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  label="Maintenance completion"
                  strategies={STRATEGIES}
                  m={byStrategy}
                  render={(m) => `${m.maintenanceCompletion.scheduled} / ${m.maintenanceCompletion.total} (${(m.maintenanceCompletion.ratio * 100).toFixed(0)}%)`}
                />
                <MetricRow label="Critical completion" strategies={STRATEGIES} m={byStrategy} render={(m) => m.criticalCompletion} />
                <MetricRow label="Overdue completion" strategies={STRATEGIES} m={byStrategy} render={(m) => m.overdueCompletion} />
                <MetricRow label="Blocks used" strategies={STRATEGIES} m={byStrategy} render={(m) => m.blocksUsed} />
                <MetricRow
                  label="Average block utilization"
                  strategies={STRATEGIES}
                  m={byStrategy}
                  render={(m) => (m.averageBlockUtilization !== null ? `${(m.averageBlockUtilization * 100).toFixed(0)}%` : "n/a")}
                />
                <MetricRow label="Cross-department bundles" strategies={STRATEGIES} m={byStrategy} render={(m) => m.bundleCount} />
                <MetricRow label="Simulated conflicts" strategies={STRATEGIES} m={byStrategy} render={(m) => m.conflictCount} />
                <MetricRow label="Estimated train delay (min)" strategies={STRATEGIES} m={byStrategy} render={(m) => m.totalDelayMinutes ?? "n/a"} />
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricRow({
  label,
  strategies,
  m,
  render,
}: {
  label: string;
  strategies: StrategyType[];
  m: Partial<Record<StrategyType, StrategyAnalytics>>;
  render: (m: StrategyAnalytics) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-rail-border/60">
      <td className="px-3 py-2 text-slate-400">{label}</td>
      {strategies.map((s) => (
        <td key={s} className="px-3 py-2 tabular-nums text-slate-200">
          {m[s] ? render(m[s]!) : "—"}
        </td>
      ))}
    </tr>
  );
}
