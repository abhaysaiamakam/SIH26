"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { AuditEvent } from "../../lib/types";

const ACTION_TONE: Record<string, "ok" | "critical" | "accent" | "neutral" | "warn"> = {
  PLAN_APPROVED: "ok",
  PLAN_REJECTED: "critical",
  PLAN_GENERATED: "accent",
  PLAN_VALIDATED: "accent",
  OPTIMIZATION_STARTED: "neutral",
  OPTIMIZATION_COMPLETED: "accent",
  REOPTIMIZATION_STARTED: "warn",
  REOPTIMIZATION_COMPLETED: "warn",
};

export default function AuditPage() {
  const { scenarioId } = useScenario();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    api
      .getAuditEvents({ scenarioId })
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [scenarioId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Audit</h1>
        <p className="text-sm text-slate-400">
          Every optimization run, validation outcome, approval decision, and what-if re-optimization recorded for this scenario, with actor,
          timestamp, and correlation metadata.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <CardHeader title="Audit Trail" subtitle={`${events.length} events`} />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No audit events recorded yet - generate a plan or trigger a what-if to populate this trail.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-b border-rail-border/60 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Badge tone={ACTION_TONE[e.action] ?? "neutral"}>{e.action}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {e.entityType} <span className="font-mono text-xs text-slate-500">{e.entityId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{e.actorUserId ? e.actorUserId.slice(0, 8) + "..." : "system"}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {e.metadata && (
                      <pre className="whitespace-pre-wrap font-mono">
                        {Object.entries(e.metadata)
                          .filter(([k]) => k !== "scenarioId")
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                          .join("  ·  ")}
                      </pre>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
