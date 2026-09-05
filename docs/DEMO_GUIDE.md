# Demo Guide

## Setup

```bash
# 1. Start Postgres (docker compose, or a local instance - see docs/ARCHITECTURE.md)
docker compose up -d postgres

# 2. Install dependencies and the Python environment
pnpm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r services/optimizer/requirements.txt -r services/simulator/requirements.txt

# 3. Configure apps/api/.env (copy from .env.example) - set DATABASE_URL and
#    PYTHON_BIN to the venv's python3 (e.g. /path/to/repo/.venv/bin/python3)

# 4. Migrate and seed
pnpm --filter @railopt/api exec prisma migrate deploy
pnpm --filter @railopt/api run seed        # seed 42 by default; also seeds 6 demo users

# 5. Run both apps
pnpm --filter @railopt/api run start:dev   # http://localhost:4000
pnpm --filter @railopt/web run dev         # http://localhost:3000
```

Demo login: any of `admin@railopt.demo`, `div.planner@railopt.demo`, `control.operator@railopt.demo`, `field.engineer@railopt.demo`, `dept.planner@railopt.demo`, `management@railopt.demo` — password `railopt-demo-2026` for all (see `apps/api/prisma/seed.ts`).

## Live walkthrough

**Step 1 — Show maintenance demand.** Open **Maintenance**. Filter by `Overdue only` to show the engineered overdue-critical requests; open one to see its department, criticality, isolation/power requirements, and dependencies.

**Step 2 — Show train movements and available block windows.** Open **Block Planning**. The timeline shows every corridor's block windows (gray bars) and train movements (blue = passenger/express/suburban, gray = goods) with no plan overlay yet.

**Step 3 — Run FIRST FEASIBLE.** Sign in as `div.planner@railopt.demo`. Open **Optimization**, click **RUN FIRST FEASIBLE**.

**Step 4 — Show baseline results.** The comparison table fills in: objective value, candidates generated/rejected, tasks scheduled, blocks used, bundles (typically 0 - naive ordering rarely discovers cross-department bundling), train delay.

**Step 5 — Run RAILOPT OPTIMIZED.** Click **RUN RAILOPT OPTIMIZED** in the same table.

**Step 6 — Show optimized results.** Compare the new row: a materially higher objective value, more bundles, and dramatically lower train delay than FIRST FEASIBLE - often while scheduling *fewer* raw tasks, because it prioritizes critical/overdue work over simply maximizing count. Open **Analytics** for the same comparison in chart form, explicitly labeled "SYNTHETIC SCENARIO RESULT."

**Step 7 — Open a scheduled block: "WHY WERE THESE TASKS BUNDLED?"** Go to **Block Planning**, select the RAILOPT OPTIMIZED plan in the dropdown, and hover a green "BUNDLE" block. Then open **Maintenance**, click into one of the bundled requests, and read its "WHY SCHEDULED?" panel - the reasons list explicitly states `Bundled with <other request> (compatible, same window)`.

**Step 8 — Open an unscheduled task: "WHY WAS IT NOT SCHEDULED?"** In **Maintenance**, open a request that wasn't scheduled by the optimized plan. Its panel reads "WHY NOT SCHEDULED?" and names the dominant rejection reason (e.g. `RESOURCE_UNAVAILABLE`, `OPERATIONAL_CONFLICT`) alongside the same priority breakdown, showing it wasn't simply ignored.

**Step 9 — Trigger "WHAT IF CORRIDOR C-03 BECOMES UNAVAILABLE?"** Open **What-If**, leave the event type on "Corridor becomes unavailable," pick `C-03 - Golf - Kilo Trunk Route`, click **TRIGGER WHAT-IF**.

**Step 10 — Re-optimize.** This happens automatically as part of the what-if run - both a fresh "before" plan and the "after" plan (with C-03's windows removed) are generated, validated, and simulated.

**Step 11 — Show OLD PLAN / NEW PLAN / DIFFERENCE.** The BEFORE/AFTER/DELTA cards appear immediately: fewer scheduled tasks, fewer blocks, fewer bundles, and (in this scenario) less train delay since C-03's own traffic is no longer affected by possession work - a real, non-canned tradeoff computed by the same optimizer and validator as everything else.

**Bonus — Approve a plan.** Back on **Optimization**, once a plan shows status `VALIDATED`, click **Approve** in the Actions column. The underlying `PlanRevision` becomes immutable in the database; attempting to approve or reject it again is refused (409). Check **Audit** to see the recorded decision.

## What this demo does NOT claim

Per `docs/PROJECT_SPEC.md`'s safety boundary: no real signal, interlocking, or traction control; no real Indian Railways data; every block/isolation/clearance shown is simulated. See `docs/SIMULATION_ASSUMPTIONS.md` for the simulator's specific assumptions.
