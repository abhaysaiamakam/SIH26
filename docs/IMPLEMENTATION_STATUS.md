# Implementation Status

This document tracks exactly what is built versus simplified/deferred, updated at the end of every phase. Nothing here should overclaim — if it's simulated, it says so; if it's deferred, it says so.

## Phase 1 — Foundation: COMPLETE

- pnpm workspace (`apps/web`, `apps/api`, `services/optimizer`, `services/simulator`, `packages/contracts`, `packages/config`, `packages/test-fixtures`, `data/synthetic`) building and typechecking cleanly.
- Full Prisma domain schema (26 tables covering Reference, Maintenance, Planning, Operations, and Validation/Governance) migrated against PostgreSQL 16 and verified with a real `prisma migrate dev` run.
- NestJS API skeleton (health endpoint, global `PrismaModule`, strict validation pipe) builds and serves against the live database.
- Next.js 14 + Tailwind frontend skeleton builds and serves.
- `packages/config/v1/*.json` versioned priority weights, objective weights, compatibility defaults, and solver settings — the single source of truth read by both the TypeScript config loader and (from Phase 3 onward) the Python optimizer.
- `packages/contracts` TypeScript types for the domain enums and the optimizer/simulator JSON contracts.
- Python 3.11 virtualenv with OR-Tools 9.15 (CP-SAT) and pydantic verified working; both `services/optimizer` and `services/simulator` scaffolded with `pyproject.toml` and a passing placeholder pytest.
- `docker-compose.yml` and Dockerfiles for `api`/`web` written and reviewed; **not fully exercised end-to-end in this build session** because this sandboxed environment's egress policy blocks Docker Hub base-image pulls (`production.cloudfront.docker.com` returns 403 from the sandbox's network policy) — this is a sandbox network restriction, not a defect in the compose files, and `docker compose up` is expected to work on a normal developer laptop. All other Phase 1 verification (schema migration, API, frontend) was instead done directly against a host-installed PostgreSQL 16 and host Node/Python runtimes, which exercises the same code paths.

## Verification run in this session

- `pnpm -r run test` — all green (api, web, data/synthetic, config, contracts).
- `pnpm -r run typecheck` — all green.
- `pnpm -r run lint` — all green (api via ESLint, web via `next lint`).
- `prisma migrate dev` against a live Postgres — 26 tables created successfully.
- `nest build` + `node dist/main.js` — API serves `/health` against the real database.
- `next build` + `next start` — frontend serves `/`.
- `pytest` in both `services/optimizer` and `services/simulator` — passing placeholders (real pipeline tests land in Phase 3/5).

## Phase 2 — Synthetic data + reference/maintenance CRUD: COMPLETE

- Deterministic seeded generator (`data/synthetic/generator`) producing, at seed 42: 2 divisions, 6 fixed corridors (`C-01`..`C-06`), 22 stations, 20 segments, 23 track resources (including 3 deliberately network-wide, capacity-1 machines), 57 assets, 66 maintenance requests, 2 request dependencies, 2 explicit compatibility-rule overrides, 21 block windows, 30 train movements, 3 background scenario events.
- Engineered scenarios are **guaranteed by construction, not chance**: at least one overdue-critical request, at least one dependency chain, at least two cross-department bundling-opportunity requests, at least two incompatible same-corridor pairs, at least two cross-corridor scarce-resource-conflict requests, and two explicit `TaskCompatibilityRule` rows that override the heuristic defaults in both directions. All eleven of these are asserted by `data/synthetic/tests/generator.spec.ts`, including same-seed determinism and different-seed variation.
- `apps/api/prisma/seed.ts` loads a generated scenario into Postgres in FK-safe order and is idempotent for a given seed (verified by reseeding twice against a live database in this session).
- NestJS `scenarios`, `corridors`, `assets`, `maintenance`, and `operations` modules implement `GET /scenarios(/:id)`, `GET /corridors(/:id)`, `GET /assets(/:id)`, `GET /maintenance(/:id)` + `POST /maintenance`, `GET /block-windows`, `GET /train-movements` — all verified against the live seeded database in this session (filters, overdue computation, dependency `dependsOn`/`blockedFor`, and request creation all exercised with real `curl` calls).
- Station coordinates and names are explicitly synthetic (ICAO-alphabet placeholder names on a fictitious grid) — no correspondence to real Indian Railways geography, per the project's data-authenticity boundary.
- Note: `MaintenanceRequest`/`BlockWindow`/`TrainMovement` are scenario-scoped, but reference data (divisions/corridors/assets/track resources) is derived from seed-specific deterministic IDs, so re-seeding with a *different* seed number creates a second, independent reference network rather than reusing one shared network across scenarios. This is a deliberate simplification for a hackathon prototype — each seed produces one complete, internally-consistent world.

## Phase 3 — Optimizer core pipeline (pre-CP-SAT): COMPLETE

- `services/optimizer/src/core/`: `normalization.py` (raw JSON → typed dataclasses), `priority_engine.py`, `compatibility_engine.py`, `bundling_engine.py`, `candidates.py`, `config_loader.py` (reads `packages/config/v1/*.json` directly - single-sourced with the TypeScript `packages/config` package, path-resolved regardless of working directory).
- Priority engine: full breakdown (`assetCriticality + maintenanceCriticality + urgency + overdue + dueSoon = total`) plus natural-language explanation, `as_of` always passed explicitly (never wall-clock) for determinism. The overdue-scoring critical rule (positive-only, never a penalty) is enforced by construction and directly tested.
- Compatibility engine: explicit `TaskCompatibilityRule` (department-scoped or global) always wins over the heuristic defaults (hard-incompatible pairs → same-department rules → cross-department allow-list), plus independent resource-sufficiency checking.
- Bundling engine: pairwise, same-corridor, cross-department compatible pairs only.
- Candidate generation: fixed-time candidates per (task-or-bundle, block window), all 8 rejection reason codes implemented and individually tested, dependency feasibility resolved in a second pass over all candidates, hard (passenger/express/suburban) vs. soft (goods, delay-only) train conflicts distinguished.
- `services/optimizer/tests/`: 39 passing pytest cases covering every rejection reason, the overdue critical rule, explicit-rule overrides in both directions, bundle discovery (positive and negative cases), and dependency feasibility (success, failure, no-predecessor-candidate, multiple-predecessor-candidates).
- See `docs/OPTIMIZATION_MODEL.md` for the full pipeline description.

## Upcoming

Phase 4 (FIRST_FEASIBLE / PRIORITY_FIRST / CP-SAT OPTIMIZED strategies, `cli.py` stdin/stdout contract, and the NestJS `optimization` module wiring `POST/GET /planning-runs`) is next.
