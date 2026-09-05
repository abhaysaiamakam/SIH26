# RAILOPT AI — Project Specification

**Project:** RAILOPT AI
**Full title:** AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways
**Competition:** Smart India Hackathon 2026
**Problem statement:** SIH26027
**Organization:** Ministry of Railways

## Mission

Build a technically credible, end-to-end decision-support prototype that demonstrates how optimization can coordinate railway maintenance block planning across three departments — Engineering/P-Way, Traction Distribution (TRD), and Signal & Telecommunication (S&T) — deciding **what**, **when**, **where**, and **which tasks can be bundled**, while validating operational feasibility and estimating traffic impact.

The system maximizes maintenance/asset availability while minimizing operational disruption, using a real OR-Tools CP-SAT optimization model over deterministic synthetic data. It is not a fake AI dashboard: every number shown is produced by an actual solver run, priority computation, or simulation, and is traceable to `PlanningRun`/`Plan`/`SimulationRun` records.

## Safety boundary

RAILOPT AI is a **decision-support and planning system**. It does **not** control real signals, interlocking, points, train movement, traction power switching, or any physical railway infrastructure. Every block grant, isolation, or clearance shown in the prototype is simulated and labeled:

> **SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE**

The prototype makes no claim of production deployment, safety certification, SIL certification, or access to real Indian Railways operational data. All data is synthetic.

## Departments

`ENGINEERING`, `TRD`, `S_AND_T` — modeled as distinct, non-interchangeable departments with different work types, isolation requirements, and cross-department compatibility rules (see `docs/OPTIMIZATION_MODEL.md`).

## Scope reference

See `docs/ARCHITECTURE.md` for system design, `docs/DOMAIN_MODEL.md` for the data model, `docs/OPTIMIZATION_MODEL.md` for the CP-SAT formulation, `docs/SIMULATION_ASSUMPTIONS.md` for every labeled simulator assumption, `docs/API.md` for the REST surface, `docs/DEMO_GUIDE.md` for the live walkthrough, and `docs/IMPLEMENTATION_STATUS.md` for exactly what is built versus simplified.
