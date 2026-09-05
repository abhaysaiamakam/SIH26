// A handful of explicit TaskCompatibilityRule rows that deliberately
// override the heuristic defaults in packages/config/v1/compatibility-defaults.json
// - one flips a default-incompatible cross-department pair to compatible,
// the other flips a default-compatible pair to incompatible. This exercises
// "explicit compatibility rules take precedence over heuristic defaults" in
// the Phase 3 compatibility engine end to end.

import { GenTaskCompatibilityRule } from "./types";

export function buildTaskCompatibilityRules(): GenTaskCompatibilityRule[] {
  return [
    {
      workTypeA: "RAIL_GRINDING",
      workTypeB: "SIGNAL_MAINTENANCE",
      department: null,
      compatible: true,
      reason: "Explicit rule: rail grinding vehicle operations may coexist with concurrent signal cable maintenance under this division's joint-possession protocol (overrides the cross-department default).",
    },
    {
      workTypeA: "GENERAL_INSPECTION",
      workTypeB: "TRACK_RENEWAL",
      department: null,
      compatible: false,
      reason: "Explicit rule: this division requires exclusive possession during track renewal, overriding the usual non-intrusive-inspection default.",
    },
  ];
}
