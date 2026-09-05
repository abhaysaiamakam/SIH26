# Architecture

## Monorepo layout

```
apps/
  web/        Next.js 14 + TypeScript + Tailwind — the only client-facing UI
  api/        NestJS 11 + TypeScript + Prisma 6 — the only path to PostgreSQL
services/
  optimizer/  Python 3.11 + OR-Tools CP-SAT — priority/compatibility/bundling/candidates/strategies
  simulator/  Python 3.11 — deterministic traffic impact estimation
packages/
  contracts/  Shared TypeScript types for API DTOs and the optimizer/simulator JSON contracts
  config/     Versioned JSON weights (priority, objective, compatibility defaults, solver settings)
  test-fixtures/  Shared fixtures consumed by both Jest and pytest to keep contracts honest
data/synthetic/  Deterministic, seeded scenario generator
docs/       This documentation set
tests/e2e/  Cross-service workflow tests
```

## Data flow

```
Synthetic Data Generator (seeded, deterministic)
        │
        ▼
PostgreSQL (via Prisma) ── apps/api (NestJS) ── apps/web (Next.js)
        │
        ▼
services/optimizer (Python, spawned as a subprocess by apps/api)
  normalization → priority engine → compatibility engine → bundling engine
  → candidate generator → { FIRST_FEASIBLE | PRIORITY_FIRST | OPTIMIZED (CP-SAT) }
        │
        ▼
Independent Validator (TypeScript, inside apps/api — re-derives every
constraint from Prisma state independently of the solver)
        │
        ▼
services/simulator (Python, spawned as a subprocess) — traffic impact estimate
        │
        ▼
Plan + PlanRevision + explainability (PlanTask.reasons / rejectionReason)
        │
        ▼
Human planner review → Approve / Reject (approved revisions are immutable)
```

**The frontend talks only to the NestJS API.** It never queries PostgreSQL directly.

## Why a subprocess, not a microservice

OR-Tools CP-SAT is Python-only. Rather than duplicating candidate generation/scoring logic in TypeScript, `apps/api` spawns `python3 services/optimizer/src/cli.py` (JSON on stdin, JSON on stdout, timeout-bounded) and persists the result. There is no message queue: `POST /planning-runs` creates a `PlanningRun` row, fires the job without blocking the HTTP response, and the client polls `GET /planning-runs/:id`. This is intentional — appropriate for a single-instance, laptop-friendly deployment, not a production claim.

## Key simplifications (see docs/IMPLEMENTATION_STATUS.md for the full list)

- No PostGIS: `Station` stores plain latitude/longitude floats. Corridor/segment/chainage covers all "where on the network" needs in this scope.
- No message queue / Kafka / Kubernetes: Docker Compose (Postgres + api + web) is sufficient for a laptop demo.
- Auth is local seeded users + RBAC guards, shaped to be OIDC-compatible later but not real OIDC now.
