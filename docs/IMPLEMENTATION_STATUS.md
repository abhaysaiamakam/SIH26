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

## Upcoming

See the phase list in `docs/PROJECT_SPEC.md` / the approved build plan — Phase 2 (synthetic data generator + reference/maintenance CRUD) is next.
