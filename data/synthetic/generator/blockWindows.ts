// Block windows: nightly possession opportunities per corridor. Each
// corridor gets a couple of generous "standard" windows plus one
// deliberately scarce, single-department, short-duration window (so some
// candidates get INSUFFICIENT_WINDOW_DURATION / ISOLATION_MISMATCH
// rejections downstream). The corridors carrying an engineered bundling
// opportunity (see maintenance.ts) additionally get a wide "bundle window"
// permitting both departments involved, timed just ahead of that pair's
// due date so the optimizer has a real feasible window to bundle them into.

import { Department, IsolationType, PowerRequirement } from "@railopt/contracts";
import { deterministicUuid } from "./ids";
import { GenBlockWindow, GenCorridor } from "./types";

const GENERATED_AT = new Date("2026-09-05T01:00:00.000Z");
function atDayOffset(days: number): string {
  return new Date(GENERATED_AT.getTime() + days * 86_400_000).toISOString();
}
function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

const ALL_DEPARTMENTS: Department[] = ["ENGINEERING", "TRD", "S_AND_T"];
const ALL_ISOLATION: IsolationType[] = ["TRACK_ISOLATION", "POWER_ISOLATION", "SIGNAL_ISOLATION", "FULL_ISOLATION"];
const ALL_POWER: PowerRequirement[] = ["NONE", "TRACTION_POWER_OFF", "AUXILIARY_POWER", "LOW_VOLTAGE"];

const SCARCE_DEPARTMENT_ROTATION: Department[] = ["ENGINEERING", "TRD", "S_AND_T"];

/** Corridor indices carrying an engineered bundling opportunity (see maintenance.ts bundlePlan) and the department pair to permit. */
const BUNDLE_WINDOWS: { corridorIndex: number; departments: Department[]; dueInDays: number }[] = [
  { corridorIndex: 0, departments: ["ENGINEERING", "TRD"], dueInDays: 8 },
  { corridorIndex: 2, departments: ["ENGINEERING", "S_AND_T"], dueInDays: 8 },
  { corridorIndex: 4, departments: ["ENGINEERING", "TRD"], dueInDays: 8 },
];

export function buildBlockWindows(seed: number, corridors: GenCorridor[]): GenBlockWindow[] {
  const windows: GenBlockWindow[] = [];

  corridors.forEach((corridor, corridorIndex) => {
    // Two generous standard windows.
    for (let i = 0; i < 2; i++) {
      const dayOffset = 3 + i * 6 + corridorIndex; // spread across ~3-25 days, corridor-staggered
      const start = atDayOffset(dayOffset);
      const durationMinutes = 240;
      windows.push({
        id: deterministicUuid(seed, "block-window", `${corridor.code}-standard-${i}`),
        corridorId: corridor.id,
        segmentId: null,
        startTime: start,
        endTime: plusMinutes(start, durationMinutes),
        durationMinutes,
        permittedDepartments: ALL_DEPARTMENTS,
        allowsIsolationTypes: ALL_ISOLATION,
        allowsPowerTypes: ALL_POWER,
        maxConcurrentResources: 3,
        operationalRestrictions: null,
      });
    }

    // One deliberately scarce window: short, single department, track
    // isolation only.
    const scarceDayOffset = 13 + corridorIndex;
    const scarceStart = atDayOffset(scarceDayOffset);
    const scarceDuration = 90;
    windows.push({
      id: deterministicUuid(seed, "block-window", `${corridor.code}-scarce`),
      corridorId: corridor.id,
      segmentId: null,
      startTime: scarceStart,
      endTime: plusMinutes(scarceStart, scarceDuration),
      durationMinutes: scarceDuration,
      permittedDepartments: [SCARCE_DEPARTMENT_ROTATION[corridorIndex % SCARCE_DEPARTMENT_ROTATION.length]],
      allowsIsolationTypes: ["TRACK_ISOLATION"],
      allowsPowerTypes: ["NONE"],
      maxConcurrentResources: 1,
      operationalRestrictions: "Single-line working only; one resource crew permitted for this window.",
    });
  });

  for (const bundle of BUNDLE_WINDOWS) {
    const corridor = corridors[bundle.corridorIndex];
    const start = atDayOffset(bundle.dueInDays - 1);
    const durationMinutes = 360;
    windows.push({
      id: deterministicUuid(seed, "block-window", `${corridor.code}-bundle`),
      corridorId: corridor.id,
      segmentId: null,
      startTime: start,
      endTime: plusMinutes(start, durationMinutes),
      durationMinutes,
      permittedDepartments: bundle.departments,
      allowsIsolationTypes: ["TRACK_ISOLATION", "POWER_ISOLATION", "SIGNAL_ISOLATION"],
      allowsPowerTypes: ["NONE", "TRACTION_POWER_OFF", "LOW_VOLTAGE"],
      maxConcurrentResources: 2,
      operationalRestrictions: "Joint possession window shared across departments listed in permittedDepartments.",
    });
  }

  return windows;
}
