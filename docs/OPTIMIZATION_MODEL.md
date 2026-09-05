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
strategies/{first_feasible,priority_first,optimized}.py
        │
        ▼
core/result.py            - builds the objective/breakdown/plan-blocks/
                             task-outcomes shared by all three strategies
        │
        ▼
cli.py                    - stdin/stdout entrypoint invoked by apps/api's
                             OptimizerClientService as a subprocess
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

## Shared conflict predicate and objective (Phase 4)

`core/conflicts.py:candidates_conflict(a, b, ...)` is the *single* function that decides whether two candidates can both be selected - shared-task overlap, time+resource overlap (combined demand exceeds a resource's capacity), and dependency ordering violations (a predecessor candidate ending after a successor candidate starts). All three strategies and the CP-SAT pairwise constraints use this exact same function, which is what makes them structurally comparable rather than comparable "by convention."

`core/result.py:build_result(scenario, candidates, selected_ids, ...)` turns a selected-candidate-id set into the final objective value/breakdown, `PlanBlock`s, and per-task `TaskOutcome`s (WHY SCHEDULED / WHY NOT SCHEDULED). It is called identically regardless of which strategy produced the selection, so objective values are directly comparable across strategies - this is what Phase 7's analytics comparison relies on.

## The three strategies

- **`strategies/first_feasible.py`**: the deterministic baseline. Offers candidates to a shared greedy-acceptance loop (`core/greedy.py`) in generation order (task order, then window order - both already deterministic), taking the first non-conflicting one per task. No notion of priority.
- **`strategies/priority_first.py`**: identical greedy loop, but candidates are offered in descending order of summed member-task priority score (tie-broken by candidate id).
- **`strategies/optimized.py`**: CP-SAT. Decision variable `x[c] ∈ {0,1}` per feasible candidate. Hard constraints: each task scheduled ≤ 1 (covers solo-vs-bundle exclusivity), plus a pairwise `x[a]+x[b] ≤ 1` for every conflicting pair per the shared predicate. Objective maximizes realized priority + bundle bonus + asset-availability benefit + block utilization, minus delay minutes, minus a per-block-used penalty (auxiliary `y[w] ≥ x[c]` per window), minus a per-missed-bundle-opportunity penalty (auxiliary `missed[t] ≥ x[c]` for any solo candidate of a task that had a bundle option). Float weights are scaled by 100 and rounded to integers for CP-SAT's native integer objective, then reported back as floats - directly comparable to the greedy strategies' objective values. Solved with `num_search_workers=1` and a fixed `random_seed` from `packages/config/v1/solver-settings.json` for determinism.

**Structural correctness property, directly tested:** since every greedy strategy's selection is by construction a feasible solution to the exact same ILP CP-SAT solves, `OPTIMIZED`'s objective value must always be ≥ both greedy strategies' objective values, for any scenario - `tests/test_strategies.py::test_optimized_objective_is_never_worse_than_either_greedy_strategy` asserts this directly rather than just eyeballing a demo scenario.

## `cli.py` stdin/stdout contract

`services/optimizer/src/cli.py` (`python3 -m src.cli`) is the process boundary invoked by `apps/api`'s `OptimizerClientService`. It reads one `OptimizerRunInput` JSON document from stdin (validated against `src/schemas.py`, a pydantic mirror of `packages/contracts/src/optimizer.ts` - field names match the wire JSON exactly), dispatches to the requested strategy, and writes one `OptimizerRunOutput` JSON document to stdout. All logging goes to stderr, never mixed with the result. Exit code 0 always means "a result was produced" (including a legitimate `NO_FEASIBLE_PLAN`, when there are tasks but zero were scheduled); non-zero means something actually failed (malformed input, an unhandled exception), with a human-readable message on stderr - this is exactly the signal `OptimizerClientService` uses to mark a `PlanningRun` `FAILED`.

`packages/test-fixtures/scripts/export-optimizer-fixture.ts` exports a real `OptimizerRunInput` document from the TypeScript synthetic generator (checked in at `packages/test-fixtures/optimizer/scenario-seed-42.json`); `services/optimizer/tests/test_cli.py` parses it end to end. This is how the TypeScript contract and the pydantic mirror are kept honest against each other without codegen.

## NestJS integration (`apps/api/src/optimization`)

`OptimizerClientService.run(input)` spawns `python3 -m src.cli` with the given `OptimizerRunInput` on stdin, a hard timeout (`OPTIMIZER_TIMEOUT_MS`, default 60s), and parses/returns the `OptimizerRunOutput` JSON - or rejects with a clear error on timeout, non-zero exit, or invalid JSON. `PlanningRunsService.create()` validates the scenario exists (404 if not), creates a `PlanningRun` row (`PENDING`), and fires the run **without awaiting** the HTTP response (`202 Accepted` with the run id) - the caller polls `GET /planning-runs/:id`. On success, the optimizer's output is persisted transactionally as `Plan` → `PlanRevision` (`revisionNumber=1`) → `PlanBlock`s → `PlanTask`s (one per maintenance request, scheduled or not, carrying `priorityBreakdown`/`reasons`/`rejectionReason` straight from the optimizer's `taskOutcomes`), and the `PlanningRun` is marked `SUCCEEDED` with `resultPlanId` set. On any failure, the `PlanningRun` is marked `FAILED` with `errorMessage` - the failure is never silent and never crashes the request.

## Testing

`services/optimizer/tests/` (55 tests as of Phase 4): the Phase 3 suite (rejection reasons, overdue-scoring critical rule, compatibility/bundling edge cases, dependency feasibility) plus Phase 4 additions - determinism for all three strategies, priority-driven divergence under a resource conflict, the CP-SAT-never-worse-than-greedy structural property, bundling actually improving the objective, the critical rule re-verified at the objective/result level (`test_result.py::test_unscheduled_overdue_task_never_makes_the_objective_negative`), and `cli.py` end-to-end (malformed input, a minimal valid scenario, and the full real seed-42 fixture). `apps/api/test/planning-runs.e2e-spec.ts` drives the real HTTP surface against a live Postgres and the real Python subprocess (no mocks): 404 on an unknown scenario, 400 on an invalid strategy, a full `OPTIMIZED` run persisting a `Plan` with blocks/tasks, and `OPTIMIZED` vs `FIRST_FEASIBLE` producing visibly different objective values on the same scenario.
