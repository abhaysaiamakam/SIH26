# Optimization Model

Implemented in `services/optimizer` (Python 3.11). This document describes what is **actually implemented**, updated as later phases add to it (CP-SAT itself lands in Phase 4 - see `docs/IMPLEMENTATION_STATUS.md` for current status).

## Pipeline

```
raw OptimizerRunInput JSON
        │
        ▼
normalization.py        - parses ISO8601 strings into datetimes, builds typed
                           dataclasses (core/models.py) for every entity
        │
        ▼
priority_engine.py       - deterministic, explainable priority score per task
        │
        ▼
compatibility_engine.py  - pairwise "can these two tasks be bundled" check
        │
        ▼
bundling_engine.py       - finds cross-department, same-corridor compatible
                           pairs across the whole task set
        │
        ▼
candidates.py             - generates (task-or-bundle, block window) candidates,
                            rejecting infeasible ones with a reason code
        │
        ▼
[Phase 4] strategies/{first_feasible,priority_first,optimized}.py
```

All config (weights, defaults) is versioned JSON in `packages/config/v1/`, loaded identically by this Python service and the TypeScript `packages/config` package - `services/optimizer/src/core/config_loader.py` walks up from its own file location to find `packages/config/v1`, so it works regardless of the working directory the process is launched from.

## Priority engine

`priority_engine.compute_priority(task, as_of, weights)` returns a score plus a full breakdown (`assetCriticality + maintenanceCriticality + urgency + overdue + dueSoon = total`) and a short natural-language explanation. `as_of` is always an explicit parameter (from `OptimizerOptions.asOf`) - the engine never reads the wall clock, which is what makes it deterministic and testable.

**Critical rule, enforced by construction:** `overdue` is only ever a *positive* addend, scaled by how many days overdue (capped). There is no separate "penalize unscheduled overdue work" term anywhere in this codebase - an overdue task that isn't scheduled simply doesn't receive this reward; it is never subtracted from anything. `tests/test_priority_engine.py` asserts this directly: increasing days-overdue never decreases the score, and no code path exists that would let it.

## Compatibility engine

`compatibility_engine.check_compatibility(taskA, taskB, resources, rules, defaults)` decides whether two tasks could share one block, in this order:

1. **Explicit `TaskCompatibilityRule`** (from the database, seeded examples in `data/synthetic/generator/compatibilityRules.ts`) - always wins over the heuristic below. A rule with `department=None` applies regardless of which departments the two tasks belong to; a rule scoped to a specific department only applies when *both* tasks belong to that department.
2. **Hard incompatible pairs** (`packages/config/v1/compatibility-defaults.json`'s `hardIncompatiblePairs`) - apply regardless of department.
3. **Same department**: `sameDepartmentIncompatiblePairs`, else `sameDepartmentDefaultCompatible`.
4. **Cross department**: `crossDepartmentAllowList`, else `crossDepartmentDefaultCompatible` (false by default - cross-department compatibility must be earned, never assumed just because two tasks share a corridor).

Independently, resource sufficiency is checked: if both tasks require the same `TrackResource`, their combined quantity must not exceed its capacity. Corridor match and resource sufficiency are folded into the final `compatible` verdict alongside the work-type rule outcome, each with its own reason string - "same corridor", "no resource conflict", etc., matching the explainability examples in the project brief.

## Bundling engine

`bundling_engine.find_bundle_pairs(tasks, resources, rules, defaults)` scans every same-corridor, cross-department task pair through the compatibility engine and returns the compatible ones. Deliberately limited to **pairs** (not larger cliques) - the brief's own bundling examples are all pairs, and same-department pairs are excluded even when compatible (a department already sequences its own work without needing a "bundle").

## Candidate generation

`candidates.generate_candidates(scenario, bundle_pairs)` produces one `Candidate` per (task-or-bundle, block window) combination **on the same corridor**, with a **fixed start/end time** (`window.startTime` → `+ max(component task durations)`, since bundled tasks run concurrently with different crews during the same possession). This fixed-time design is what lets FIRST_FEASIBLE, PRIORITY_FIRST, and CP-SAT (Phase 4) all choose from the *identical* candidate list - none of them decide *when* work happens, only *which* precomputed candidates to activate.

Each candidate is evaluated against every hard constraint up front and rejected with exactly one of the 8 reason codes if infeasible:

| Reason | Trigger |
|---|---|
| `CORRIDOR_MISMATCH` | task/bundle corridor ≠ window corridor |
| `OPERATIONAL_CONFLICT` | window doesn't permit the task's department, **or** a hard-conflict (passenger/express/suburban) train overlaps the candidate's time |
| `INSUFFICIENT_WINDOW_DURATION` | window shorter than the required duration |
| `ISOLATION_MISMATCH` | required isolation type not in the window's allowed set |
| `POWER_REQUIREMENT_UNAVAILABLE` | required power type not in the window's allowed set |
| `RESOURCE_UNAVAILABLE` | combined resource demand exceeds capacity, or exceeds the window's `maxConcurrentResources` |
| `INCOMPATIBLE_WORK_TYPES` | (bundle candidates only) a defense-in-depth re-check via the compatibility engine |
| `DEPENDENCY_NOT_FEASIBLE` | the task is a dependency successor and **no** predecessor candidate (for that predecessor task) ends before this candidate starts - checked in a second pass, since it needs every candidate's timing computed first |

A **soft** conflict - a `GOODS` train overlapping the candidate's time - never rejects the candidate; it instead accumulates `estimated_delay_minutes`, which later feeds the objective's delay-minimization term and the simulator. This hard/soft distinction is a **SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE**.

Solo candidates and bundle candidates for the same task always coexist in the output - choosing between "scheduled alone", "scheduled as part of a bundle", or "not scheduled at all" is left entirely to the strategy/solver (Phase 4), never decided here.

## Testing

`services/optimizer/tests/` (39 tests as of Phase 3): one test per rejection reason, the overdue-scoring critical rule, explicit-rule-overrides-heuristic in both directions, department-scoped rule matching, resource-sufficiency in both engines, bundle-pair discovery (including negative cases: different corridors, incompatible work types, same-department pairs), and dependency feasibility (success, failure, "predecessor has zero feasible candidates", and "only one of several predecessor candidates needs to satisfy the ordering").
