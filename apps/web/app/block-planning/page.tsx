"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import { BlockPlanningTimeline } from "../../components/BlockPlanningTimeline";
import type { BlockWindow, Corridor, Plan, PlanBlock, TrainMovement } from "../../lib/types";

export default function BlockPlanningPage() {
  const { scenarioId } = useScenario();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [windows, setWindows] = useState<BlockWindow[]>([]);
  const [trains, setTrains] = useState<TrainMovement[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    Promise.all([api.getCorridors(), api.getBlockWindows(scenarioId), api.getTrainMovements(scenarioId), api.getPlans({ scenarioId })]).then(
      ([c, w, t, p]) => {
        setCorridors(c);
        setWindows(w);
        setTrains(t);
        setPlans(p);
        const preferred = p.find((pl) => pl.status === "APPROVED") ?? p.find((pl) => pl.strategy === "OPTIMIZED") ?? p[0];
        setSelectedPlanId(preferred?.id ?? "");
        setLoading(false);
      },
    );
  }, [scenarioId]);

  useEffect(() => {
    if (!selectedPlanId) {
      setBlocks([]);
      return;
    }
    api.getPlan(selectedPlanId).then((plan) => setBlocks(plan.revisions[0]?.blocks ?? []));
  }, [selectedPlanId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Block Planning</h1>
          <p className="text-sm text-slate-400">Corridor timelines: available windows, train movements, and the selected plan&apos;s blocks.</p>
        </div>
        <select
          value={selectedPlanId}
          onChange={(e) => setSelectedPlanId(e.target.value)}
          className="rounded border border-rail-border bg-rail-bg px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="">No plan overlay (windows &amp; trains only)</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.strategy} · {p.status} · obj {p.objectiveValue?.toFixed(0)}
            </option>
          ))}
        </select>
      </div>

      <Card className="flex flex-wrap gap-4 p-3 text-xs">
        <Legend swatch="bg-slate-600/50" label="Block window (available)" />
        <Legend swatch="bg-sky-400" label="Passenger / express / suburban train" />
        <Legend swatch="bg-slate-400" label="Goods train" />
        <Legend swatch="bg-blue-700 border border-blue-400" label="Scheduled block (single department)" />
        <Legend swatch="bg-green-800 border border-green-400" label="Scheduled block (cross-department bundle)" />
      </Card>

      <Card>
        <CardHeader title="Timeline" subtitle={loading ? "Loading..." : `${corridors.length} corridors`} />
        <div className="p-4">
          {loading ? <p className="text-sm text-slate-500">Loading...</p> : <BlockPlanningTimeline corridors={corridors} windows={windows} trains={trains} blocks={blocks} />}
        </div>
      </Card>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className={`inline-block h-2.5 w-4 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}
