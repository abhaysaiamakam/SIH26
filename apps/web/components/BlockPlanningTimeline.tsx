"use client";

import { useMemo } from "react";
import type { BlockWindow, Corridor, PlanBlock, TrainMovement } from "../lib/types";

const PX_PER_HOUR = 6;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 96;

const TRAIN_COLOR: Record<string, string> = {
  PASSENGER: "#38bdf8",
  EXPRESS: "#a78bfa",
  SUBURBAN: "#38bdf8",
  GOODS: "#94a3b8",
};

export function BlockPlanningTimeline({
  corridors,
  windows,
  trains,
  blocks,
}: {
  corridors: Corridor[];
  windows: BlockWindow[];
  trains: TrainMovement[];
  blocks: PlanBlock[];
}) {
  const { minTime, maxTime } = useMemo(() => {
    const times = [
      ...windows.flatMap((w) => [new Date(w.startTime).getTime(), new Date(w.endTime).getTime()]),
      ...trains.flatMap((t) => [new Date(t.scheduledStart).getTime(), new Date(t.scheduledEnd).getTime()]),
      ...blocks.flatMap((b) => [new Date(b.startTime).getTime(), new Date(b.endTime).getTime()]),
    ];
    if (times.length === 0) return { minTime: Date.now(), maxTime: Date.now() + 86_400_000 };
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [windows, trains, blocks]);

  const totalHours = Math.max(1, (maxTime - minTime) / 3_600_000);
  const timelineWidth = totalHours * PX_PER_HOUR;

  function xFor(iso: string) {
    return ((new Date(iso).getTime() - minTime) / 3_600_000) * PX_PER_HOUR;
  }
  function widthFor(startIso: string, endIso: string) {
    return Math.max(2, xFor(endIso) - xFor(startIso));
  }

  const dayTicks: { x: number; label: string }[] = [];
  for (let t = minTime; t <= maxTime; t += 86_400_000) {
    dayTicks.push({ x: ((t - minTime) / 3_600_000) * PX_PER_HOUR, label: new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ width: timelineWidth + LABEL_WIDTH }}>
        {/* day axis */}
        <div className="relative h-6" style={{ marginLeft: LABEL_WIDTH }}>
          {dayTicks.map((t) => (
            <div key={t.x} className="absolute top-0 border-l border-rail-border pl-1 text-[10px] text-slate-500" style={{ left: t.x }}>
              {t.label}
            </div>
          ))}
        </div>

        {corridors.map((corridor) => {
          const corridorWindows = windows.filter((w) => w.corridorId === corridor.id);
          const corridorTrains = trains.filter((t) => t.corridorId === corridor.id);
          const corridorBlocks = blocks.filter((b) => b.corridorId === corridor.id);

          return (
            <div key={corridor.id} className="flex border-t border-rail-border" style={{ height: ROW_HEIGHT }}>
              <div className="flex shrink-0 flex-col justify-center pr-2 text-right" style={{ width: LABEL_WIDTH }}>
                <span className="text-xs font-semibold text-slate-200">{corridor.code}</span>
                <span className="text-[10px] text-slate-500">{corridor.name}</span>
              </div>
              <div className="relative flex-1" style={{ width: timelineWidth }}>
                {/* block windows - background */}
                {corridorWindows.map((w) => (
                  <div
                    key={w.id}
                    title={`Window ${new Date(w.startTime).toLocaleString()} - ${new Date(w.endTime).toLocaleTimeString()}`}
                    className="absolute top-1 h-3 rounded-sm bg-slate-600/30"
                    style={{ left: xFor(w.startTime), width: widthFor(w.startTime, w.endTime) }}
                  />
                ))}
                {/* train movements */}
                {corridorTrains.map((t) => (
                  <div
                    key={t.id}
                    title={`${t.trainType} ${t.trainNumber}: ${new Date(t.scheduledStart).toLocaleString()}`}
                    className="absolute top-5 h-1.5 rounded-sm opacity-80"
                    style={{ left: xFor(t.scheduledStart), width: widthFor(t.scheduledStart, t.scheduledEnd), background: TRAIN_COLOR[t.trainType] }}
                  />
                ))}
                {/* plan blocks */}
                {corridorBlocks.map((b) => (
                  <div
                    key={b.id}
                    title={`${b.isBundle ? "Bundled block" : "Block"} ${b.department ?? ""}: ${new Date(b.startTime).toLocaleString()}`}
                    className="absolute top-8 h-5 rounded border-2 flex items-center justify-center text-[9px] font-semibold text-white"
                    style={{
                      left: xFor(b.startTime),
                      width: widthFor(b.startTime, b.endTime),
                      background: b.isBundle ? "#166534" : "#1d4ed8",
                      borderColor: b.isBundle ? "#4ade80" : "#60a5fa",
                    }}
                  >
                    {b.isBundle ? "BUNDLE" : b.department}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
