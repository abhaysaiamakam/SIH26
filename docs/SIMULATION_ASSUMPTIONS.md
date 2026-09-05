# Simulation Assumptions

`services/simulator` (Python) estimates the operational impact of a plan revision's blocks. It is explicitly a **prototype approximation, not a production railway traffic simulator** - it has no route, speed, signalling, or timetable-recovery model. Every assumption it makes is returned in its `assumptions` array, and every entry is prefixed with:

> **SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE**

## What it actually computes (`services/simulator/src/impact.py`)

1. **Delay** is the raw time-overlap (in minutes) between a possession block and a train's scheduled window on the same corridor - nothing about actual dwell time, recovery margins, or downstream knock-on delay elsewhere on the network is modeled.
2. **Hard vs. soft conflicts**: an overlap with a `PASSENGER`/`EXPRESS`/`SUBURBAN` movement is reported as a `HARD_OPERATIONAL_CONFLICT` (this should never occur in a plan the independent validator marked `VALID` - the optimizer rejects such candidates outright, see `docs/OPTIMIZATION_MODEL.md`). An overlap with a `GOODS` movement is treated as absorbable delay only.
3. **Block utilization** is computed only against the block's own window (`utilizedMinutes / windowMinutes`) - cross-corridor or network-wide utilization effects are not modeled.

## Where this is used

`apps/api/src/simulation` invokes `python3 -m src.cli` (same subprocess pattern as the optimizer - see `docs/ARCHITECTURE.md`) after a plan revision is validated `VALID`, and persists the result as a `SimulationRun` row. The What-If engine (`apps/api/src/what-if`) re-runs both validation and simulation for its "after" state, so a before/after delta always reflects a re-simulated, re-validated outcome, not a stale estimate.

## What this prototype does NOT claim

- Real-time train positions, signalling state, or interlocking status.
- Actual passenger/freight schedule adherence or recovery behavior.
- Network-wide capacity or congestion effects beyond the corridor a block sits on.
- Any connection to real Indian Railways operational systems or data.

Every block grant, isolation, or clearance shown anywhere in RAILOPT AI is simulated, per `docs/PROJECT_SPEC.md`'s safety boundary.
