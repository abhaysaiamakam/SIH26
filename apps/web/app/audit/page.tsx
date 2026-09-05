"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { ApprovalDecision } from "../../lib/types";

interface AuditRow {
  planId: string;
  strategy: string;
  decision: ApprovalDecision;
}

export default function AuditPage() {
  const { scenarioId } = useScenario();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    api.getPlans({ scenarioId }).then(async (plans) => {
      const details = await Promise.all(plans.map((p) => api.getPlan(p.id)));
      const collected: AuditRow[] = [];
      for (const plan of details) {
        for (const revision of plan.revisions) {
          for (const decision of revision.approvalDecisions) {
            collected.push({ planId: plan.id, strategy: plan.strategy, decision });
          }
        }
      }
      collected.sort((a, b) => new Date(b.decision.createdAt).getTime() - new Date(a.decision.createdAt).getTime());
      setRows(collected);
      setLoading(false);
    });
  }, [scenarioId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Audit</h1>
        <p className="text-sm text-slate-400">
          Plan governance decisions recorded for this scenario. A systematic audit trail covering every mutation type (audit middleware +{" "}
          <code className="text-slate-300">AuditEvent</code>) is planned for a later hardening phase - see docs/IMPLEMENTATION_STATUS.md.
        </p>
      </div>

      <Card className="overflow-x-auto">
        <CardHeader title="Approval Decisions" subtitle={`${rows.length} recorded`} />
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Strategy</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2">Decided By</th>
              <th className="px-3 py-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No plans have been approved or rejected yet for this scenario.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.decision.id} className="border-b border-rail-border/60">
                  <td className="px-3 py-2 text-slate-400">{new Date(row.decision.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{row.planId.slice(0, 8)}...</td>
                  <td className="px-3 py-2 text-slate-300">{row.strategy}</td>
                  <td className="px-3 py-2">
                    <Badge tone={row.decision.decision === "APPROVED" ? "ok" : "critical"}>{row.decision.decision}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{row.decision.decidedBy?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{row.decision.comment ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
