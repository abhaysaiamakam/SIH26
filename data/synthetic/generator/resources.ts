// Track resources: a mix of corridor-scoped crews (plentiful) and a small
// pool of globally-scarce machines (capacity 1-2), which is what makes
// resource-conflict candidates arise naturally once maintenance demand is
// generated on top of them (see maintenance.ts).

import { deterministicUuid } from "./ids";
import { GenCorridor, GenTrackResource } from "./types";

export function buildTrackResources(seed: number, corridors: GenCorridor[]): GenTrackResource[] {
  const resources: GenTrackResource[] = [];

  for (const corridor of corridors) {
    resources.push(
      {
        id: deterministicUuid(seed, "resource", `${corridor.code}-eng-crew`),
        code: `${corridor.code}-ENG-CREW`,
        name: `${corridor.code} Engineering Possession Crew`,
        type: "CREW",
        corridorId: corridor.id,
        capacity: 2,
      },
      {
        id: deterministicUuid(seed, "resource", `${corridor.code}-trd-crew`),
        code: `${corridor.code}-TRD-CREW`,
        name: `${corridor.code} TRD OHE Crew`,
        type: "CREW",
        corridorId: corridor.id,
        capacity: 1,
      },
      {
        id: deterministicUuid(seed, "resource", `${corridor.code}-snt-crew`),
        code: `${corridor.code}-SNT-CREW`,
        name: `${corridor.code} S&T Signal Crew`,
        type: "CREW",
        corridorId: corridor.id,
        capacity: 1,
      },
    );
  }

  // Deliberately scarce, network-wide shared machines - the same machine
  // being required by two requests on different corridors in overlapping
  // windows is the mechanism that produces RESOURCE_UNAVAILABLE rejections.
  const scarceMachines = [
    { key: "rail-grinding-machine", code: "RGM-1", name: "Rail Grinding Machine RGM-1", capacity: 1 },
    { key: "ballast-cleaning-machine", code: "BCM-1", name: "Ballast Cleaning Machine BCM-1", capacity: 1 },
    { key: "tamping-machine", code: "TM-1", name: "Tamping Machine TM-1", capacity: 1 },
  ];
  for (const m of scarceMachines) {
    resources.push({
      id: deterministicUuid(seed, "resource", m.key),
      code: m.code,
      name: m.name,
      type: "MACHINE",
      corridorId: null,
      capacity: m.capacity,
    });
  }

  resources.push(
    {
      id: deterministicUuid(seed, "resource", "rail-panel-stock"),
      code: "MAT-RAIL-PANEL",
      name: "Rail Panel Stock",
      type: "MATERIAL",
      corridorId: null,
      capacity: 5,
    },
    {
      id: deterministicUuid(seed, "resource", "ultrasonic-test-kit"),
      code: "TOOL-UST-KIT",
      name: "Ultrasonic Test Kit",
      type: "TOOL",
      corridorId: null,
      capacity: 3,
    },
  );

  return resources;
}
