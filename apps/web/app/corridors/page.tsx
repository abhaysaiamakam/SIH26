"use client";

import { useEffect, useState } from "react";
import * as api from "../../lib/api-client";
import { Card, CardHeader } from "../../components/ui/Card";
import { CorridorMap } from "../../components/CorridorMap";
import type { Corridor } from "../../lib/types";

export default function CorridorsPage() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCorridors().then((list) => {
      setCorridors(list);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Corridors</h1>
        <p className="text-sm text-slate-400">Reference network topology - shared across scenarios. All geography is synthetic.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Network Diagram" />
          <div className="p-4">
            <CorridorMap corridors={corridors} highlightCorridorId={selected} />
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <CardHeader title="Corridors" subtitle={`${corridors.length} corridors`} />
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rail-border text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Division</th>
                <th className="px-3 py-2">Length</th>
                <th className="px-3 py-2">Segments</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : (
                corridors.map((c) => (
                  <tr
                    key={c.id}
                    onMouseEnter={() => setSelected(c.id)}
                    onMouseLeave={() => setSelected(null)}
                    className="cursor-default border-b border-rail-border/60 hover:bg-white/5"
                  >
                    <td className="px-3 py-2 font-medium text-slate-100">{c.code}</td>
                    <td className="px-3 py-2 text-slate-300">{c.name}</td>
                    <td className="px-3 py-2 text-slate-400">{c.division?.code}</td>
                    <td className="px-3 py-2 text-slate-400">{c.totalLengthKm} km</td>
                    <td className="px-3 py-2 text-slate-400">{c.segments?.length ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
