# API

Base URL: `http://localhost:4000` (dev). All responses are JSON. All mutating endpoints validate their body with `class-validator` DTOs (unknown fields rejected via `whitelist`/`forbidNonWhitelisted`).

Endpoints below are implemented incrementally by phase - see `docs/IMPLEMENTATION_STATUS.md` for exactly what exists today.

## Reference / scenarios (Phase 2)

- `GET /health` — liveness check.
- `GET /scenarios` — all generated planning scenarios, newest first.
- `GET /scenarios/:id` — one scenario.
- `GET /corridors` — all corridors with division, origin/destination station, and ordered segments.
- `GET /corridors/:id` — one corridor, plus its track resources.
- `GET /assets?corridorId=&criticality=` — filterable asset list.
- `GET /assets/:id` — one asset with its maintenance history.

## Maintenance (Phase 2)

- `GET /maintenance?scenarioId=&department=&corridorId=&criticality=&status=&overdue=true` — filterable list; every row carries a computed `overdue` boolean (`dueDate < now` and status not in `COMPLETED`/`CLOSED`).
- `GET /maintenance/:id` — full detail: asset, corridor/segment, required resources, `dependsOn` (predecessors) and `blockedFor` (successors).
- `POST /maintenance` — create a request (DTO-validated: department, assetId, corridorId, workType, description, criticality, urgency, dueDate, estimatedDurationMinutes, optional segmentId/requiredIsolation/requiredPower/requiredResources). The request number is generated as `<DEPT>-<CORRIDOR_CODE>-<seq>`.

## Operations (Phase 2)

- `GET /block-windows?scenarioId=&corridorId=` — defaults to the most recently generated scenario when `scenarioId` is omitted.
- `GET /train-movements?scenarioId=&corridorId=` — same default-scenario behavior.

## Planned (later phases)

- `POST /planning-runs`, `GET /planning-runs/:id` — Phase 4 (optimizer integration).
- `GET /plans`, `GET /plans/:id`, `POST /plans/:id/approve`, `POST /plans/:id/reject` — Phase 5.
- `POST /what-if` — Phase 5.
- `GET /analytics` — Phase 7.
- `auth`/RBAC-guarded write paths — Phase 5.
