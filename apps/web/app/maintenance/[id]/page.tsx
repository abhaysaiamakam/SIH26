"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as api from "../../../lib/api-client";
import { useScenario } from "../../../lib/scenario-context";
import { Card, CardHeader } from "../../../components/ui/Card";
import { CriticalityBadge, DepartmentBadge, StatusBadge } from "../../../components/ui/Badge";
import type { MaintenanceRequest, Plan, PlanTask } from "../../../lib/types";

export default function MaintenanceDetailPage({ params }: { params: { id: string } }) {
  const { scenarioId } = useScenario();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [planTask, setPlanTask] = useState<PlanTask | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getMaintenanceRequest(params.id).then(async (req) => {
      if (cancelled) return;
      setRequest(req);
      if (scenarioId) {
        const plans = await api.getPlans({ scenarioId });
        const latest = plans.find((p) => p.strategy === "OPTIMIZED") ?? plans[0];
        if (latest) {
          const full = await api.getPlan(latest.id);
          if (cancelled) return;
          setPlan(full);
          const task = full.revisions[0]?.tasks.find((t) => t.maintenanceRequestId === req.id) ?? null;
          setPlanTask(task);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, scenarioId]);

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (!request) return <p className="text-sm text-red-400">Request not found.</p>;

  const block = planTask?.planBlockId ? plan?.revisions[0]?.blocks.find((b) => b.id === planTask.planBlockId) : null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/maintenance" className="text-xs text-rail-accent hover:underline">
          ← Back to Maintenance
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-white">{request.requestNumber}</h1>
        <p className="text-sm text-slate-400">{request.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Request Detail" />
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            <Field label="Department"><DepartmentBadge value={request.department} /></Field>
            <Field label="Status"><StatusBadge value={request.status} /></Field>
            <Field label="Criticality"><CriticalityBadge value={request.criticality} /></Field>
            <Field label="Urgency"><CriticalityBadge value={request.urgency} /></Field>
            <Field label="Asset">{request.asset?.name ?? request.assetId}</Field>
            <Field label="Corridor">{request.corridor?.code ?? request.corridorId}</Field>
            <Field label="Work Type">{request.workType.replace(/_/g, " ")}</Field>
            <Field label="Due Date">
              {new Date(request.dueDate).toLocaleString()} {request.overdue && <span className="text-red-400">(overdue)</span>}
            </Field>
            <Field label="Estimated Duration">{request.estimatedDurationMinutes} min</Field>
            <Field label="Isolation">{request.requiredIsolation}</Field>
            <Field label="Power">{request.requiredPower}</Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Required Resources" />
          <div className="p-4 text-sm">
            {!request.requiredResources || request.requiredResources.length === 0 ? (
              <p className="text-slate-500">No dedicated resources required.</p>
            ) : (
              <ul className="space-y-1">
                {request.requiredResources.map((r, i) => (
                  <li key={i} className="text-slate-300">
                    {r.trackResource?.name ?? r.trackResourceId} × {r.quantity}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Dependencies" />
          <div className="space-y-3 p-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Depends on (must happen first)</p>
              {!request.dependsOn || request.dependsOn.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                request.dependsOn.map((d) => (
                  <Link key={d.id} href={`/maintenance/${d.id}`} className="block text-rail-accent hover:underline">
                    {d.requestNumber}
                  </Link>
                ))
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Blocks (must happen before)</p>
              {!request.blockedFor || request.blockedFor.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                request.blockedFor.map((d) => (
                  <Link key={d.id} href={`/maintenance/${d.id}`} className="block text-rail-accent hover:underline">
                    {d.requestNumber}
                  </Link>
                ))
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={planTask?.scheduled ? "WHY SCHEDULED?" : "WHY NOT SCHEDULED?"} subtitle={plan ? `From latest plan (${plan.strategy})` : undefined} />
          <div className="p-4 text-sm">
            {!plan ? (
              <p className="text-slate-500">No plan has been generated yet for this scenario.</p>
            ) : !planTask ? (
              <p className="text-slate-500">This request was not part of the latest plan&apos;s candidate set.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Priority score: {planTask.priorityScore.toFixed(1)}</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {Object.entries(planTask.priorityBreakdown)
                      .filter(([k]) => k !== "total")
                      .map(([k, v]) => (
                        <div key={k} className="rounded border border-rail-border bg-rail-bg px-2 py-1.5 text-center">
                          <div className="truncate text-slate-500" title={k}>
                            {k.replace(/([A-Z])/g, " $1")}
                          </div>
                          <div className="font-semibold text-slate-100">+{Number(v).toFixed(0)}</div>
                        </div>
                      ))}
                  </div>
                </div>
                <ul className="list-disc space-y-1 pl-4 text-slate-300">
                  {planTask.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                {block && (
                  <p className="text-xs text-slate-500">
                    Scheduled {new Date(block.startTime).toLocaleString()} - {new Date(block.endTime).toLocaleTimeString()}
                    {block.isBundle && " (bundled block)"}
                  </p>
                )}
                {!planTask.scheduled && planTask.rejectionReason && (
                  <p className="text-xs font-medium text-red-400">Dominant rejection reason: {planTask.rejectionReason}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-slate-200">{children}</div>
    </div>
  );
}
