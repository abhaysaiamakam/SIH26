"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import type { Asset, BlockWindow, Corridor, MaintenanceRequest, WhatIfResult } from "../../lib/types";

const EVENT_TYPES = [
  { key: "CORRIDOR_UNAVAILABLE", label: "Corridor becomes unavailable" },
  { key: "BLOCK_WINDOW_SHORTENED", label: "Block window shortened" },
  { key: "NEW_CRITICAL_REQUEST", label: "New critical maintenance request" },
  { key: "ADDITIONAL_TRAIN_MOVEMENT", label: "Additional train movement" },
  { key: "TASK_BECOMES_OVERDUE", label: "Existing task becomes overdue" },
];

const WORK_TYPES = [
  "TRACK_RENEWAL",
  "RAIL_GRINDING",
  "BALLAST_CLEANING",
  "POINTS_CROSSING_MAINTENANCE",
  "BRIDGE_INSPECTION",
  "SIGNAL_MAINTENANCE",
  "INTERLOCKING_UPGRADE",
  "OHE_MAINTENANCE",
  "TRACTION_SUBSTATION_MAINTENANCE",
  "GENERAL_INSPECTION",
];

export default function WhatIfPage() {
  const { scenarioId } = useScenario();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [windows, setWindows] = useState<BlockWindow[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  const [eventType, setEventType] = useState(EVENT_TYPES[0].key);
  const [corridorId, setCorridorId] = useState("");
  const [blockWindowId, setBlockWindowId] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [assetId, setAssetId] = useState("");
  const [department, setDepartment] = useState("ENGINEERING");
  const [workType, setWorkType] = useState(WORK_TYPES[0]);
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [dueInDays, setDueInDays] = useState(3);
  const [maintenanceRequestId, setMaintenanceRequestId] = useState("");
  const [trainType, setTrainType] = useState("GOODS");
  const [trainStart, setTrainStart] = useState("");
  const [trainEnd, setTrainEnd] = useState("");

  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    api.getCorridors().then(setCorridors);
    api.getBlockWindows(scenarioId).then(setWindows);
    api.getAssets().then(setAssets);
    api.getMaintenanceRequests({ scenarioId }).then(setRequests);
  }, [scenarioId]);

  function buildPayload(): Record<string, unknown> {
    switch (eventType) {
      case "CORRIDOR_UNAVAILABLE":
        return { corridorId };
      case "BLOCK_WINDOW_SHORTENED":
        return { blockWindowId, newDurationMinutes: newDuration };
      case "NEW_CRITICAL_REQUEST": {
        const asset = assets.find((a) => a.id === assetId);
        return { assetId, corridorId: asset?.corridorId, department, workType, estimatedDurationMinutes: durationMinutes, dueInDays };
      }
      case "ADDITIONAL_TRAIN_MOVEMENT":
        return { corridorId, trainType, scheduledStart: new Date(trainStart).toISOString(), scheduledEnd: new Date(trainEnd).toISOString(), priority: 5 };
      case "TASK_BECOMES_OVERDUE":
        return { maintenanceRequestId };
      default:
        return {};
    }
  }

  async function trigger() {
    if (!scenarioId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.postWhatIf({ scenarioId, eventType, strategy: "OPTIMIZED", payload: buildPayload() });
      setResult(res);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "What-if run failed - sign in as a planner");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">What-If</h1>
        <p className="text-sm text-slate-400">Simulate a disruption and compare the re-optimized plan against the current baseline.</p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Event type">
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={selectCls}>
              {EVENT_TYPES.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
          </Field>

          {eventType === "CORRIDOR_UNAVAILABLE" && (
            <Field label="Corridor">
              <select value={corridorId} onChange={(e) => setCorridorId(e.target.value)} className={selectCls}>
                <option value="">Select corridor...</option>
                {corridors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {eventType === "BLOCK_WINDOW_SHORTENED" && (
            <>
              <Field label="Block window">
                <select value={blockWindowId} onChange={(e) => setBlockWindowId(e.target.value)} className={selectCls}>
                  <option value="">Select window...</option>
                  {windows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.corridor?.code ?? w.corridorId} · {new Date(w.startTime).toLocaleDateString()} ({w.durationMinutes}min)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="New duration (min)">
                <input type="number" value={newDuration} onChange={(e) => setNewDuration(Number(e.target.value))} className={inputCls} />
              </Field>
            </>
          )}

          {eventType === "NEW_CRITICAL_REQUEST" && (
            <>
              <Field label="Asset">
                <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={selectCls}>
                  <option value="">Select asset...</option>
                  {assets.slice(0, 100).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.corridor?.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectCls}>
                  {["ENGINEERING", "TRD", "S_AND_T"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Work type">
                <select value={workType} onChange={(e) => setWorkType(e.target.value)} className={selectCls}>
                  {WORK_TYPES.map((w) => (
                    <option key={w} value={w}>
                      {w.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Duration (min)">
                <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label="Due in (days)">
                <input type="number" value={dueInDays} onChange={(e) => setDueInDays(Number(e.target.value))} className={inputCls} />
              </Field>
            </>
          )}

          {eventType === "ADDITIONAL_TRAIN_MOVEMENT" && (
            <>
              <Field label="Corridor">
                <select value={corridorId} onChange={(e) => setCorridorId(e.target.value)} className={selectCls}>
                  <option value="">Select corridor...</option>
                  {corridors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Train type">
                <select value={trainType} onChange={(e) => setTrainType(e.target.value)} className={selectCls}>
                  {["PASSENGER", "EXPRESS", "GOODS", "SUBURBAN"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start">
                <input type="datetime-local" value={trainStart} onChange={(e) => setTrainStart(e.target.value)} className={inputCls} />
              </Field>
              <Field label="End">
                <input type="datetime-local" value={trainEnd} onChange={(e) => setTrainEnd(e.target.value)} className={inputCls} />
              </Field>
            </>
          )}

          {eventType === "TASK_BECOMES_OVERDUE" && (
            <Field label="Maintenance request">
              <select value={maintenanceRequestId} onChange={(e) => setMaintenanceRequestId(e.target.value)} className={selectCls}>
                <option value="">Select request...</option>
                {requests.slice(0, 100).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requestNumber}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <button onClick={trigger} disabled={loading} className="rounded bg-rail-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
            {loading ? "Running..." : "TRIGGER WHAT-IF"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </Card>

      {result && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ComparisonCard title="BEFORE" summary={result.before} />
          <ComparisonCard title="AFTER" summary={result.after} />
          <Card>
            <CardHeader title="DELTA" />
            <div className="space-y-2 p-4 text-sm">
              <DeltaRow label="Objective" value={result.delta.objectiveValue} />
              <DeltaRow label="Scheduled tasks" value={result.delta.scheduledCount} />
              <DeltaRow label="Overdue scheduled" value={result.delta.overdueScheduledCount} />
              <DeltaRow label="Bundles" value={result.delta.bundleCount} />
              <DeltaRow label="Blocks used" value={result.delta.blocksUsed} />
              {result.delta.totalDelayMinutes !== null && <DeltaRow label="Train delay (min)" value={result.delta.totalDelayMinutes} invert />}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const selectCls = "rounded border border-rail-border bg-rail-bg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-rail-accent";
const inputCls = selectCls + " w-28";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {children}
    </label>
  );
}

function ComparisonCard({ title, summary }: { title: string; summary: WhatIfResult["before"] }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={`Plan status: ${summary.status}`} />
      <div className="space-y-1.5 p-4 text-sm">
        <Row label="Objective" value={summary.objectiveValue.toFixed(1)} />
        <Row label="Scheduled" value={`${summary.scheduledCount} / ${summary.totalCount}`} />
        <Row label="Overdue scheduled" value={summary.overdueScheduledCount} />
        <Row label="Blocks used" value={summary.blocksUsed} />
        <Row label="Bundles" value={summary.bundleCount} />
        <Row label="Train delay (min)" value={summary.totalDelayMinutes ?? "n/a"} />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}

function DeltaRow({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={positive ? "font-medium text-emerald-400" : negative ? "font-medium text-red-400" : "font-medium text-slate-300"}>
        {value > 0 ? "+" : ""}
        {value.toFixed ? value.toFixed(1) : value}
      </span>
    </div>
  );
}
