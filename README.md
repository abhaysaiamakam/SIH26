# RAILOPT AI

A decision-support prototype for **SIH26027** — *AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways* (Smart India Hackathon 2026, Ministry of Railways).

RAILOPT AI coordinates railway maintenance block planning across three departments (Engineering/P-Way, TRD, S&T), deciding what, when, where, and which tasks can be bundled — using a real OR-Tools CP-SAT optimization model over deterministic synthetic data, an independently-reimplemented validator, a deterministic traffic simulator, and a full what-if engine. Every number shown is produced by an actual solver run, priority computation, or simulation — never hardcoded.

**Safety boundary:** this is a decision-support system only. It does not control real signals, interlocking, points, traction power, or any physical railway infrastructure, and it does not use real Indian Railways data. See [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Documentation

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) — mission, safety boundary, scope
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, monorepo layout, data flow
- [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) — the Prisma domain schema
- [`docs/OPTIMIZATION_MODEL.md`](docs/OPTIMIZATION_MODEL.md) — priority/compatibility/bundling engines, candidate generation, the CP-SAT formulation, and the three strategies
- [`docs/SIMULATION_ASSUMPTIONS.md`](docs/SIMULATION_ASSUMPTIONS.md) — every labeled traffic-simulation assumption
- [`docs/API.md`](docs/API.md) — the REST surface
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) — setup and an 11-step live walkthrough
- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — exactly what is built versus simplified, phase by phase

## Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind (`apps/web`)
- **Backend:** NestJS 11 + TypeScript + Prisma 6 + PostgreSQL 16 (`apps/api`)
- **Optimizer:** Python 3.11 + OR-Tools CP-SAT (`services/optimizer`)
- **Simulator:** Python 3.11 (`services/simulator`)
- **Monorepo:** pnpm workspaces

## Quick start

See [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) for full setup instructions, demo logins, and a step-by-step walkthrough. In short:

```bash
docker compose up -d postgres
pnpm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r services/optimizer/requirements.txt -r services/simulator/requirements.txt
pnpm --filter @railopt/api exec prisma migrate deploy
pnpm --filter @railopt/api run seed
pnpm --filter @railopt/api run start:dev   # http://localhost:4000
pnpm --filter @railopt/web run dev         # http://localhost:3000
```

## Testing

```bash
pnpm -r run typecheck && pnpm -r run lint && pnpm -r run test   # TypeScript workspaces
pytest                                                          # inside services/optimizer and services/simulator
```
