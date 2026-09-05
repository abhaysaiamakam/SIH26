"""OPTIMIZED: CP-SAT model over the exact same candidate list the greedy
strategies use. See docs/OPTIMIZATION_MODEL.md for the full formulation.

Decision variable: x[c] in {0,1} per feasible candidate c.

Hard constraints:
  - each task scheduled at most once (also covers solo-vs-bundle exclusivity
    for the same task, and duplicate-bundle exclusivity)
  - pairwise mutual exclusion for every conflicting candidate pair, using
    the exact same core.conflicts.candidates_conflict predicate the greedy
    strategies use (time/resource overlap, dependency ordering)

Objective: maximize realized priority (asset/maintenance criticality,
urgency, and the always-positive overdue bonus - see priority_engine.py)
plus bundle/asset-availability/utilization bonuses, minus delay minutes,
minus a per-block-used penalty, minus a per-missed-bundle-opportunity
penalty. All weights come from packages/config/v1/objective-weights.json.

CP-SAT requires integer objective coefficients, so every float weight is
scaled by SCALE and rounded; the reported objectiveValue is divided back
down, so it remains directly comparable to the greedy strategies' (float)
objective values computed by core/result.py.
"""

from __future__ import annotations

from typing import Any

from ortools.sat.python import cp_model

from ..core.candidates import Candidate
from ..core.conflicts import candidates_conflict
from ..core.models import NormalizedScenario
from ..core.priority_engine import compute_priority

SCALE = 100


def _duration_minutes(c: Candidate) -> float:
    return (c.end_time - c.start_time).total_seconds() / 60.0


def run(
    scenario: NormalizedScenario,
    candidates: list[Candidate],
    priority_weights: dict[str, Any],
    objective_weights: dict[str, Any],
    solver_settings: dict[str, Any],
    time_limit_seconds: float,
) -> tuple[set[str], str]:
    """Returns (selected_candidate_ids, solver_status_string)."""

    feasible = [c for c in candidates if c.feasible]
    tasks_by_id = {t.id: t for t in scenario.tasks}
    windows_by_id = {w.id: w for w in scenario.block_windows}
    priority_by_task = {t.id: compute_priority(t, scenario.as_of, priority_weights).score for t in scenario.tasks}

    if not feasible:
        return set(), "OPTIMAL"

    model = cp_model.CpModel()
    x: dict[str, cp_model.IntVar] = {c.id: model.NewBoolVar(c.id) for c in feasible}

    # Each task scheduled at most once (covers solo-vs-bundle exclusivity).
    candidates_by_task: dict[str, list[Candidate]] = {}
    for c in feasible:
        for tid in c.task_ids:
            candidates_by_task.setdefault(tid, []).append(c)
    for task_id, task_candidates in candidates_by_task.items():
        model.Add(sum(x[c.id] for c in task_candidates) <= 1)

    # Pairwise conflicts (time/resource overlap, dependency ordering) -
    # shared-task pairs are already covered by the constraint above.
    for i in range(len(feasible)):
        for j in range(i + 1, len(feasible)):
            a, b = feasible[i], feasible[j]
            if set(a.task_ids) & set(b.task_ids):
                continue
            if candidates_conflict(a, b, tasks_by_id, scenario.resources_by_id, scenario.dependencies):
                model.Add(x[a.id] + x[b.id] <= 1)

    # Auxiliary: one boolean per block window actually used, for the
    # block-used penalty term.
    windows_used_ids = {c.block_window_id for c in feasible}
    y: dict[str, cp_model.IntVar] = {wid: model.NewBoolVar(f"used-{wid}") for wid in windows_used_ids}
    for c in feasible:
        model.Add(y[c.block_window_id] >= x[c.id])

    # Auxiliary: one boolean per task that has a bundle option, indicating
    # it was scheduled solo instead (a "missed" bundling opportunity).
    bundle_task_ids = {tid for c in feasible if c.is_bundle for tid in c.task_ids}
    missed: dict[str, cp_model.IntVar] = {}
    for task_id in bundle_task_ids:
        solo_candidates = [c for c in candidates_by_task.get(task_id, []) if not c.is_bundle]
        if not solo_candidates:
            continue
        missed[task_id] = model.NewBoolVar(f"missed-{task_id}")
        for c in solo_candidates:
            model.Add(missed[task_id] >= x[c.id])

    objective_terms = []
    for c in feasible:
        priority_value = sum(priority_by_task[tid] for tid in c.task_ids) * objective_weights["priorityWeight"]
        bundle_value = objective_weights["bundleBonusPerExtraTask"] * (len(c.task_ids) - 1) if c.is_bundle else 0.0
        asset_value = sum(objective_weights["assetAvailabilityPoints"][tasks_by_id[tid].asset_criticality] for tid in c.task_ids)
        window = windows_by_id[c.block_window_id]
        utilization_value = objective_weights["blockUtilizationWeight"] * (_duration_minutes(c) / window.duration_minutes)
        delay_value = objective_weights["delayMinutePenalty"] * c.estimated_delay_minutes
        net_value = priority_value + bundle_value + asset_value + utilization_value - delay_value
        objective_terms.append(round(net_value * SCALE) * x[c.id])

    for wid, var in y.items():
        objective_terms.append(-round(objective_weights["blockUsedPenalty"] * SCALE) * var)
    for task_id, var in missed.items():
        objective_terms.append(-round(objective_weights["fragmentationPenaltyPerBlock"] * SCALE) * var)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = solver_settings.get("numSearchWorkers", 1)
    solver.parameters.random_seed = solver_settings.get("randomSeed", 42)
    solver.parameters.max_time_in_seconds = time_limit_seconds

    status = solver.Solve(model)

    if status == cp_model.OPTIMAL:
        status_str = "OPTIMAL"
    elif status == cp_model.FEASIBLE:
        status_str = "FEASIBLE"
    else:
        status_str = "INFEASIBLE"

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return set(), status_str

    selected_ids = {c.id for c in feasible if solver.Value(x[c.id]) == 1}
    return selected_ids, status_str
