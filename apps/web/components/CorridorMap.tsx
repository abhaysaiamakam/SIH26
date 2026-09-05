"use client";

import type { Corridor } from "../lib/types";

const WIDTH = 640;
const HEIGHT = 320;
const PADDING = 30;

/** A schematic network diagram, not a geographic map - station positions
 * are projected from the generator's synthetic lat/lng grid, which does
 * not correspond to any real place. Labeled accordingly in the UI. */
export function CorridorMap({ corridors, highlightCorridorId }: { corridors: Corridor[]; highlightCorridorId?: string | null }) {
  const stations = new Map<string, { id: string; code: string; name: string; latitude: number; longitude: number }>();
  for (const c of corridors) {
    if (c.originStation) stations.set(c.originStation.id, c.originStation);
    if (c.destinationStation) stations.set(c.destinationStation.id, c.destinationStation);
  }
  const points = [...stations.values()];
  if (points.length === 0) return <p className="p-4 text-sm text-slate-500">No corridor geometry available.</p>;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  function project(lat: number, lng: number): [number, number] {
    const x = PADDING + ((lng - minLng) / (maxLng - minLng || 1)) * (WIDTH - 2 * PADDING);
    const y = HEIGHT - PADDING - ((lat - minLat) / (maxLat - minLat || 1)) * (HEIGHT - 2 * PADDING);
    return [x, y];
  }

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Synthetic corridor network diagram">
        {corridors.map((c) => {
          if (!c.originStation || !c.destinationStation) return null;
          const [x1, y1] = project(c.originStation.latitude, c.originStation.longitude);
          const [x2, y2] = project(c.destinationStation.latitude, c.destinationStation.longitude);
          const highlighted = highlightCorridorId === c.id;
          return (
            <g key={c.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={highlighted ? "#2f81f7" : "#33415c"}
                strokeWidth={highlighted ? 3 : 2}
              />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize={10} textAnchor="middle" fill={highlighted ? "#2f81f7" : "#64748b"}>
                {c.code}
              </text>
            </g>
          );
        })}
        {points.map((s) => {
          const [x, y] = project(s.latitude, s.longitude);
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={4} fill="#94a3b8" />
              <text x={x} y={y - 8} fontSize={9} textAnchor="middle" fill="#cbd5e1">
                {s.code}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-slate-500">
        Synthetic schematic network diagram - station positions are illustrative, not real geography.
      </p>
    </div>
  );
}
