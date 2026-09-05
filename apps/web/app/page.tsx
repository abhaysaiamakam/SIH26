"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import * as api from "../lib/api-client";
import { useAuth } from "../lib/auth-context";
import { useScenario } from "../lib/scenario-context";
import { StatCard } from "../components/ui/StatCard";
import { Card, CardHeader } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/Badge";
import type { MaintenanceRequest, BlockWindow, Plan } from "../lib/types";

export default function CommandCenterPage() {
  const { scenarioId } = useScenario();
  const { hasRole, user } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [windows, setWindows] = useState<BlockWindow[]>([]);
  const [latestPlan, setLatestPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scenarioId) return;
    setLoading(true);
    try {
      const [reqs, wins, plans] = await Promise.all([
        api.getMaintenanceRequests({ scenarioId }),
        api.getBlockWindows(scenarioId),
        api.getPlans({ scenarioId }),
      ]);
      setRequests(reqs);
      setWindows(wins);
      const optimized = plans.find((p) => p.strategy === "OPTIMIZED") ?? plans[0] ?? null;
      setLatestPlan(optimized ? await api.getPlan(optimized.id) : null);
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateOptimalPlan() {
    if (!scenarioId) return;
    setRunError(null);
    setRunStatus("Submitting...");
    try {
      const run = await api.createPlanningRun(scenarioId, "OPTIMIZED");
      setRunStatus("Solving...");
      const finished = await api.pollPlanningRun(run.id);
      if (finished.status === "SUCCEEDED") {
        setRunStatus("Done");
        await load();
      } else {
        setRunError(finished.errorMessage ?? "Planning run failed");
        setRunStatus(null);
      }
    } catch (err) {
      setRunError(err instanceof api.ApiError ? err.message : "Failed to generate plan");
      setRunStatus(null);
    }
  }

  const criticalOverdue = requests.filter((r) => r.overdue && r.criticality === "CRITICAL");
  const revision = latestPlan?.revisions[0];
  const scheduledTasks = revision?.tasks.filter((t) => t.scheduled) ?? [];
  const criticalScheduled = scheduledTasks.filter((t) => {
    const req = requests.find((r) => r.id === t.maintenanceRequestId);
    return req?.criticality === "CRITICAL";
  });
  const bundleBlocks = revision?.blocks.filter((b) => b.isBundle) ?? [];
  const simulation = revision?.simulationRuns[0];
  const avgUtilization =
    simulation && simulation.blockUtilization.length > 0
      ? simulation.blockUtilization.reduce((sum, u) => sum + u.utilizationRatio, 0) / simulation.blockUtilization.length
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Command Center</h1>
          <p className="text-sm text-slate-400">Synthetic demonstration scenario - see docs/PROJECT_SPEC.md.</p>
        </div>
        <div className="text-right">
          <button
            onClick={generateOptimalPlan}
            disabled={!scenarioId || runStatus === "Submitting..." || runStatus === "Solving..."}
            title={!user ? "Sign in as a planner to run the optimizer" : undefined}
            className="rounded bg-rail-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {runStatus === "Solving..." || runStatus === "Submitting..." ? runStatus : "GENERATE OPTIMAL PLAN"}
          </button>
          {runError && <p className="mt-1 max-w-xs text-xs text-red-400">{runError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Maintenance Requests" value={requests.length} />
        <StatCard label="Critical Overdue" value={criticalOverdue.length} tone={criticalOverdue.length > 0 ? "critical" : "ok"} />
        <StatCard label="Available Block Windows" value={windows.length} />
        <StatCard label="Planned Blocks (latest)" value={revision?.blocks.length ?? "—"} />
        <StatCard label="Avg. Block Utilization" value={avgUtilization !== null ? `${Math.round(avgUtilization * 100)}%` : "—"} />
        <StatCard label="Critical Tasks Scheduled" value={revision ? `${criticalScheduled.length}` : "—"} tone="ok" />
        <StatCard label="Est. Train Delay (min)" value={simulation ? simulation.totalDelayMinutes : "—"} tone="warn" />
        <StatCard label="Cross-Department Bundles" value={revision ? bundleBlocks.length : "—"} />
      </div>

      <Card>
        <CardHeader
          title="Latest Optimized Plan"
          subtitle={latestPlan ? `Strategy ${latestPlan.strategy} · Objective ${latestPlan.objectiveValue?.toFixed(1)}` : "No plan generated yet"}
          right={
            latestPlan && (
              <Link href="/optimization" className="text-xs font-medium text-rail-accent hover:underline">
                View in Optimization →
              </Link>
            )
          }
        />
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : !latestPlan ? (
            <p className="text-sm text-slate-500">
              No plan has been generated for this scenario yet. Click <span className="font-semibold text-slate-300">GENERATE OPTIMAL PLAN</span> to
              run RAILOPT&apos;s CP-SAT optimizer against the current maintenance demand.
            </p>
          ) : (
            <div className="flex items-center gap-6 text-sm">
              <div>
                Status: <StatusBadge value={latestPlan.status} />
              </div>
              <div>
                Scheduled: <span className="font-medium text-slate-100">{scheduledTasks.length}</span> / {revision?.tasks.length}
              </div>
              <div>
                Solver: <span className="font-medium text-slate-100">{latestPlan.solverStatus}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
