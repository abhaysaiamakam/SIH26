# API

Base URL: `http://localhost:4000` (dev). All responses are JSON. All mutating endpoints validate their body with `class-validator` DTOs (unknown fields rejected via `whitelist`/`forbidNonWhitelisted`).

**The frontend (`apps/web`) is the only intended caller and talks exclusively through this API - it never touches PostgreSQL directly.**

## Reference / scenarios

- `GET /health` — liveness check.
- `GET /scenarios` — all generated planning scenarios, newest first.
- `GET /scenarios/:id` — one scenario.
- `GET /corridors` — all corridors with division, origin/destination station, and ordered segments.
- `GET /corridors/:id` — one corridor, plus its track resources.
- `GET /assets?corridorId=&criticality=` — filterable asset list.
- `GET /assets/:id` — one asset with its maintenance history.

## Maintenance

- `GET /maintenance?scenarioId=&department=&corridorId=&criticality=&status=&overdue=true` — filterable list; every row carries a computed `overdue` boolean (`dueDate < now` and status not in `COMPLETED`/`CLOSED`).
- `GET /maintenance/:id` — full detail: asset, corridor/segment, required resources, `dependsOn` (predecessors) and `blockedFor` (successors).
- `POST /maintenance` — create a request (DTO-validated: department, assetId, corridorId, workType, description, criticality, urgency, dueDate, estimatedDurationMinutes, optional segmentId/requiredIsolation/requiredPower/requiredResources). The request number is generated as `<DEPT>-<CORRIDOR_CODE>-<seq>`. Requires an authenticated FIELD_ENGINEER/DEPARTMENT_PLANNER/DIVISIONAL_PLANNER token.

## Operations

- `GET /block-windows?scenarioId=&corridorId=` — defaults to the most recently generated scenario when `scenarioId` is omitted.
- `GET /train-movements?scenarioId=&corridorId=` — same default-scenario behavior.

## Auth

- `POST /auth/login` — body `{ email, password }`. Returns `{ accessToken, user: { id, email, name, roles } }`. Six demo users are seeded (`pnpm run seed`), one per role, all sharing password `railopt-demo-2026` (see `apps/api/prisma/seed.ts`) - e.g. `div.planner@railopt.demo`, `admin@railopt.demo`.
- Mutating endpoints require `Authorization: Bearer <token>` and check the caller's roles server-side (`ADMIN` always passes): `POST /maintenance` (FIELD_ENGINEER/DEPARTMENT_PLANNER/DIVISIONAL_PLANNER), `POST /planning-runs` (DIVISIONAL_PLANNER/CONTROL_OPERATOR/MANAGEMENT), `POST /plans/:id/approve|reject` (DIVISIONAL_PLANNER/MANAGEMENT), `POST /what-if` (DIVISIONAL_PLANNER/CONTROL_OPERATOR/MANAGEMENT). All `GET` endpoints remain unauthenticated for the demo. Architecture is OIDC-compatible later (a real identity provider could replace the local JWT issuance without touching the guards) but this is local email/password auth today, not real OIDC.

## Optimization

- `POST /planning-runs` — body `{ scenarioId, strategy: "FIRST_FEASIBLE" | "PRIORITY_FIRST" | "OPTIMIZED" }`. 404 if the scenario doesn't exist, 400 if the strategy is invalid. Returns `202 Accepted` with the created `PlanningRun` (`status: "PENDING"`) immediately - the run itself executes asynchronously (spawns the Python optimizer as a subprocess; see `docs/OPTIMIZATION_MODEL.md`).
- `GET /planning-runs/:id` — poll this until `status` is `SUCCEEDED` or `FAILED`. On success, `resultPlanId`/`objectiveValue`/`solverStatus`/`candidateCount`/`feasibleCandidateCount`/`rejectedCandidateCount`/`solveTimeMs` are populated and a full `Plan` → `PlanRevision` → `PlanBlock`/`PlanTask` tree has been persisted. On failure, `errorMessage` explains what went wrong (subprocess timeout, non-zero exit, invalid output) - never silent.

## Plans

- `GET /plans?scenarioId=&status=` — list plans.
- `GET /plans/:id` — full detail: all revisions (newest first), each with its blocks, tasks, validation runs, simulation runs, and approval decisions.
- `POST /plans/:id/approve` — body `{ comment? }`. Requires the plan to be `VALIDATED` (never an `INVALID` or already-decided plan - 400/409 otherwise). Marks the latest revision `isImmutable=true` and the plan `APPROVED`.
- `POST /plans/:id/reject` — body `{ comment? }`. Refuses (409) if the plan is already `APPROVED` (immutable) or already `REJECTED`.

## What-If

- `POST /what-if` — body `{ scenarioId, eventType, strategy?, payload }`. `eventType` is one of `CORRIDOR_UNAVAILABLE`, `NEW_CRITICAL_REQUEST`, `BLOCK_WINDOW_SHORTENED`, `ADDITIONAL_TRAIN_MOVEMENT`, `TASK_BECOMES_OVERDUE`. Runs synchronously: generates a "before" plan from the unmodified scenario, applies the event, generates an "after" plan, validates and (if valid) simulates both, and returns `{ before, after, delta }` summaries plus the persisted `scenarioEventId`. See `docs/OPTIMIZATION_MODEL.md` for exactly how each event type is applied and which are persisted vs. purely hypothetical for that one comparison.

## Analytics

- `GET /analytics?scenarioId=` — server-side comparison of the three strategies for one scenario. For each strategy with a persisted `VALIDATED`/`APPROVED` plan, returns objective value, maintenance completion (scheduled/total/ratio), critical/overdue completion counts, blocks used, bundle count, average block utilization, conflict count, and total simulated delay minutes - all derived from the actual persisted `Plan`/`PlanRevision`/`SimulationRun` rows, never hardcoded. A strategy with no plan yet for that scenario is simply omitted from the array. The response is always labeled `"label": "SYNTHETIC SCENARIO RESULT"`.

## Audit

- `GET /audit-events?scenarioId=&entityType=&limit=` — the full audit trail, newest first. Every mutation across the plan lifecycle writes an `AuditEvent` (`SCENARIO_CREATED`, `OPTIMIZATION_STARTED`, `PLAN_GENERATED`, `PLAN_VALIDATED`, `OPTIMIZATION_COMPLETED`, `PLAN_APPROVED`, `PLAN_REJECTED`, `REOPTIMIZATION_STARTED`, `REOPTIMIZATION_COMPLETED`) with the acting user, before/after snapshots, and metadata (e.g. `scenarioId`, approval comment, objective delta). `scenarioId` filters via a JSON-path match on `metadata.scenarioId`. Audit writes are best-effort (wrapped so a logging failure never fails the caller's mutation) and never claim to be a tamper-evident/compliance-grade audit log - see `docs/IMPLEMENTATION_STATUS.md`.
