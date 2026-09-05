# Domain Model

Full Prisma schema: `apps/api/prisma/schema.prisma`. All primary keys are UUIDs, all timestamps are UTC (`Timestamptz`), all enums are explicit, and every hot query path (status, dueDate, corridorId, scenarioId, time ranges) is indexed.

## Reference data (not scenario-scoped)

- **Division** — top-level organizational unit. Two synthetic divisions: `CD` (Central Division) and `WD` (Western Division).
- **Station** — a synthetic station with plain `latitude`/`longitude` floats (no PostGIS - see `docs/IMPLEMENTATION_STATUS.md`).
- **Corridor** — a route between an origin and destination station. Six fixed corridors, `C-01`..`C-06`, three per division.
- **CorridorSegment** — a chainage-bounded slice of a corridor, sequentially numbered.
- **TrackResource** — a crew, machine, material, or tool with a capacity. Corridor-scoped crews are plentiful; a handful of machines (`RGM-1`, `BCM-1`, `TM-1`) are deliberately network-wide and capacity-1, which is what produces real resource-conflict candidates once maintenance demand is generated.
- **Asset** — a physical asset (rail, OHE mast, signal interlocking, bridge, etc.) on a corridor/segment with a criticality.

## Maintenance

- **MaintenanceRequest** — the core unit of demand: department, asset, corridor/segment, work type, criticality/urgency, due date, estimated duration, isolation/power requirements, status (`OPEN → VERIFIED → PRIORITIZED → BLOCK_REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED → CLOSED`). Scoped to a `PlanningScenario`.
- **MaintenanceRequestResource** — join table to `TrackResource` with a required quantity.
- **RequestDependency** — predecessor/successor ordering (e.g. inspection before repair).
- **TaskCompatibilityRule** — explicit `(workTypeA, workTypeB, department?) → compatible` overrides, which take precedence over the heuristic defaults in `packages/config/v1/compatibility-defaults.json` (see `docs/OPTIMIZATION_MODEL.md`).

## Planning

- **BlockWindow** — a possession opportunity: corridor/segment, start/end, permitted departments, allowed isolation/power types, resource concurrency limit. Scoped to a scenario.
- **PlanningScenario** — a named, seeded, versioned-config demand snapshot. `MaintenanceRequest`, `BlockWindow`, `TrainMovement`, and `ScenarioEvent` all belong to exactly one scenario; reference data (divisions/corridors/assets/resources) is shared.
- **PlanningRun** — one solver invocation (strategy + scenario), tracking status/solverStatus/objectiveValue and the raw input snapshot sent to the optimizer.
- **Plan** / **PlanRevision** — a plan is a container; each revision is a concrete, versioned schedule. An approved revision is immutable (`isImmutable=true`) — further changes always fork a new revision, never mutate an approved one.
- **PlanBlock** — one scheduled possession inside a revision (possibly a cross-department bundle).
- **PlanTask** — one row per maintenance request *considered* in a revision, scheduled or not. This is the explainability backbone: `scheduled`, `priorityScore`, `priorityBreakdown` (JSON), `reasons` (JSON string array), and `rejectionReason` together answer both "why was this scheduled" and "why wasn't this scheduled" from a single table.

## Operations

- **TrainMovement** — a passenger/express/goods/suburban movement on a corridor with a priority. Scoped to a scenario.
- **ScenarioEvent** — either background narrative (`source=SYNTHETIC`, generated alongside the scenario) or an actual disruption trigger (`source=WHAT_IF`, created by the What-If API in Phase 5).
- **SimulationRun** — one traffic-impact estimate for a plan revision. Every entry in its `assumptions` JSON array is prefixed `"SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE"`.

## Validation / Governance

- **ValidationRun** — one independent-validator pass over a plan revision: `VALID`/`INVALID` plus a `violations` JSON array of `{code, severity, message, relatedTaskIds}`.
- **ApprovalDecision**, **User**, **RoleAssignment** — governance and RBAC (6 roles: `FIELD_ENGINEER`, `DEPARTMENT_PLANNER`, `DIVISIONAL_PLANNER`, `CONTROL_OPERATOR`, `MANAGEMENT`, `ADMIN`).
- **AuditEvent** — actor/action/entity/before/after/correlation for every mutating operation.

## Synthetic data generator

`data/synthetic/generator` is a deterministic (seeded PRNG, no `Math.random()`), reproducible generator: same seed → byte-identical output (verified by a Jest test), different seed → different output. The physical network topology (division/station/corridor/segment codes) is intentionally kept **stable across seeds** so a demo can always refer to "corridor C-03" - only the operational demand generated on top of it (assets, maintenance, trains, windows) varies by seed.

At the default seed (42) it produces: 2 divisions, 6 corridors, 22 stations, 20 segments, 23 track resources, 57 assets, 66 maintenance requests, 21 block windows, 30 train movements, 3 background scenario events - all comfortably over the project's minimum scale targets.

The generator does not rely on chance for the scenarios the optimizer must be able to handle - it explicitly constructs, regardless of seed: an overdue-critical request, at least one dependency chain, at least one cross-department bundling opportunity, at least one incompatible same-corridor pair, and at least one cross-corridor scarce-resource conflict (all verified by `data/synthetic/tests/generator.spec.ts`). It also seeds two explicit `TaskCompatibilityRule` rows that deliberately override the heuristic defaults in both directions, to exercise "explicit rules win over heuristics" end to end.

Load it into Postgres with: `pnpm --filter @railopt/api run seed [seedNumber]` (defaults to 42). Re-running with the same seed number is idempotent.
