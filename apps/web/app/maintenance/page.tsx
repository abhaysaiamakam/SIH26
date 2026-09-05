"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as api from "../../lib/api-client";
import { useScenario } from "../../lib/scenario-context";
import { Card } from "../../components/ui/Card";
import { CriticalityBadge, DepartmentBadge, StatusBadge } from "../../components/ui/Badge";
import type { MaintenanceRequest } from "../../lib/types";

const DEPARTMENTS = ["ENGINEERING", "TRD", "S_AND_T"];
const CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES = ["OPEN", "VERIFIED", "PRIORITIZED", "BLOCK_REQUESTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED"];

export default function MaintenancePage() {
  const { scenarioId } = useScenario();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [criticality, setCriticality] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => {
    if (!scenarioId) return;
    setLoading(true);
    api
      .getMaintenanceRequests({
        scenarioId,
        department: department || undefined,
        criticality: criticality || undefined,
        status: status || undefined,
        overdue: overdueOnly || undefined,
      })
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [scenarioId, department, criticality, status, overdueOnly]);

  const sorted = useMemo(() => [...requests].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [requests]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Maintenance</h1>
        <p className="text-sm text-slate-400">All demand requested across Engineering, TRD, and S&amp;T for this scenario.</p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select label="Department" value={department} onChange={setDepartment} options={DEPARTMENTS} />
        <Select label="Criticality" value={criticality} onChange={setCriticality} options={CRITICALITIES} />
        <Select label="Status" value={status} onChange={setStatus} options={STATUSES} />
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue only
        </label>
        <span className="ml-auto text-xs text-slate-500">{sorted.length} requests</span>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Asset</th>
              <th className="px-3 py-2">Corridor</th>
              <th className="px-3 py-2">Work Type</th>
              <th className="px-3 py-2">Criticality</th>
              <th className="px-3 py-2">Urgency</th>
              <th className="px-3 py-2">Due Date</th>
              <th className="px-3 py-2">Overdue</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.id} className="border-b border-rail-border/60 hover:bg-white/5">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/maintenance/${r.id}`} className="font-medium text-rail-accent hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <DepartmentBadge value={r.department} />
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.asset?.name ?? r.assetId}</td>
                  <td className="px-3 py-2 text-slate-300">{r.corridor?.code ?? r.corridorId}</td>
                  <td className="px-3 py-2 text-slate-300">{r.workType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    <CriticalityBadge value={r.criticality} />
                  </td>
                  <td className="px-3 py-2">
                    <CriticalityBadge value={r.urgency} />
                  </td>
                  <td className="px-3 py-2 text-slate-400">{new Date(r.dueDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.overdue ? <span className="text-red-400">Yes</span> : <span className="text-slate-500">No</span>}</td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.status} />
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-rail-border bg-rail-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-rail-accent"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
