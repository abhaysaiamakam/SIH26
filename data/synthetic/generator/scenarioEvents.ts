// Background scenario narrative: a few SYNTHETIC-source events describing
// context for the demo (not applied to any plan - appliedAt stays null).
// Actual disruption triggering happens later via the What-If API, which
// creates its own ScenarioEvent rows with source=WHAT_IF.

import { deterministicUuid } from "./ids";
import { GenCorridor, GenScenarioEvent } from "./types";

export function buildScenarioEvents(seed: number, corridors: GenCorridor[]): GenScenarioEvent[] {
  const c03 = corridors.find((c) => c.code === "C-03");
  const events: GenScenarioEvent[] = [
    {
      id: deterministicUuid(seed, "scenario-event", "c03-history"),
      eventType: "CORRIDOR_UNAVAILABLE",
      source: "SYNTHETIC",
      payload: {
        note: "Corridor C-03 has a history of unplanned possessions due to embankment work in the adjoining division - included as background context for the What-If demo.",
        corridorId: c03?.id ?? null,
        corridorCode: "C-03",
      },
    },
    {
      id: deterministicUuid(seed, "scenario-event", "new-critical-request-note"),
      eventType: "NEW_CRITICAL_REQUEST",
      source: "SYNTHETIC",
      payload: {
        note: "Divisional planners flagged that new critical requests arrive mid-cycle roughly weekly - modeled by the What-If engine's NEW_CRITICAL_REQUEST event type.",
      },
    },
    {
      id: deterministicUuid(seed, "scenario-event", "overdue-drift-note"),
      eventType: "TASK_BECOMES_OVERDUE",
      source: "SYNTHETIC",
      payload: {
        note: "Some PRIORITIZED tasks drift into overdue status if not scheduled within a cycle - modeled by the What-If engine's TASK_BECOMES_OVERDUE event type.",
      },
    },
  ];
  return events;
}
