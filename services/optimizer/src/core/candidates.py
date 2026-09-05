"""Candidate generation: turns (task-or-bundle, block window) pairs into
Candidate records, rejecting infeasible ones up front with one of the 8
reason codes from the project brief. This is deliberately separate from
optimization - CP-SAT (and the two greedy strategies) only ever choose
among the *feasible* candidates this module produces; none of them
re-derive feasibility themselves.

Candidates carry FIXED start/end times (window.startTime -> +duration) -
the solver decides only which candidates to activate, not when work
happens. See docs/OPTIMIZATION_MODEL.md for why.

Hard-passenger-service overlap during a candidate's time window is treated
as a genuine OPERATIONAL_CONFLICT (rejected outright): running possession
work while a passenger train needs the line is not something this
prototype will ever recommend. An overlapping GOODS movement is a soft
conflict - reflected in estimated_delay_minutes and left for the objective
/ simulator to weigh, not rejected outright. This distinction is a
SIMULATION ASSUMPTION - NOT A PRODUCTION RAILWAY RULE.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Optional

from .bundling_engine import BundlePair
from .compatibility_engine import check_compatibility
from .config_loader import load_compatibility_defaults
from .models import BlockWindow, CompatibilityRule, NormalizedScenario, Task, TrackResource

HARD_CONFLICT_TRAIN_TYPES = ("PASSENGER", "EXPRESS", "SUBURBAN")

REJECTION_REASONS = frozenset(
    {
        "INSUFFICIENT_WINDOW_DURATION",
        "RESOURCE_UNAVAILABLE",
        "CORRIDOR_MISMATCH",
        "ISOLATION_MISMATCH",
        "POWER_REQUIREMENT_UNAVAILABLE",
        "OPERATIONAL_CONFLICT",
        "INCOMPATIBLE_WORK_TYPES",
        "DEPENDENCY_NOT_FEASIBLE",
    }
)


@dataclass(frozen=True)
class Candidate:
    id: str
    task_ids: tuple[str, ...]
    is_bundle: bool
    corridor_id: str
    block_window_id: str
    start_time: datetime
    end_time: datetime
    feasible: bool
    rejection_reason: Optional[str]
    estimated_delay_minutes: int


def _required_duration_minutes(group_tasks: list[Task]) -> int:
    # Bundled tasks run concurrently in the same possession (different
    # crews, same window) - the block only needs to cover the longest one.
    return max(t.estimated_duration_minutes for t in group_tasks)


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def evaluate_candidate(
    group_tasks: list[Task],
    window: BlockWindow,
    resources_by_id: dict[str, TrackResource],
    train_movements: tuple,
    compatibility_rules: tuple[CompatibilityRule, ...],
) -> tuple[bool, Optional[str], int]:
    """Returns (feasible, rejection_reason, estimated_delay_minutes). Pure
    function over a single (group, window) pair - does not know about
    dependencies or other candidates, which are cross-candidate concerns
    handled in generate_candidates.
    """
    required_duration = _required_duration_minutes(group_tasks)

    if any(t.corridor_id != window.corridor_id for t in group_tasks):
        return False, "CORRIDOR_MISMATCH", 0

    departments = {t.department for t in group_tasks}
    if not departments.issubset(set(window.permitted_departments)):
        return False, "OPERATIONAL_CONFLICT", 0

    if window.duration_minutes < required_duration:
        return False, "INSUFFICIENT_WINDOW_DURATION", 0

    for t in group_tasks:
        if t.required_isolation != "NONE" and t.required_isolation not in window.allows_isolation_types:
            return False, "ISOLATION_MISMATCH", 0
    for t in group_tasks:
        if t.required_power != "NONE" and t.required_power not in window.allows_power_types:
            return False, "POWER_REQUIREMENT_UNAVAILABLE", 0

    demand: dict[str, int] = defaultdict(int)
    for t in group_tasks:
        for r in t.required_resources:
            demand[r.resource_id] += r.quantity
    for resource_id, qty in demand.items():
        resource = resources_by_id.get(resource_id)
        capacity = resource.capacity if resource else 1
        if qty > capacity:
            return False, "RESOURCE_UNAVAILABLE", 0
    if window.max_concurrent_resources is not None and len(demand) > window.max_concurrent_resources:
        return False, "RESOURCE_UNAVAILABLE", 0

    if len(group_tasks) > 1:
        defaults = load_compatibility_defaults()
        for i in range(len(group_tasks)):
            for j in range(i + 1, len(group_tasks)):
                result = check_compatibility(group_tasks[i], group_tasks[j], resources_by_id, compatibility_rules, defaults)
                if not result.work_types_compatible:
                    return False, "INCOMPATIBLE_WORK_TYPES", 0

    start_time = window.start_time
    end_time = start_time + timedelta(minutes=required_duration)

    for tm in train_movements:
        if tm.corridor_id != window.corridor_id:
            continue
        if not _overlaps(start_time, end_time, tm.scheduled_start, tm.scheduled_end):
            continue
        if tm.train_type in HARD_CONFLICT_TRAIN_TYPES:
            return False, "OPERATIONAL_CONFLICT", 0

    delay_minutes = 0
    for tm in train_movements:
        if tm.corridor_id != window.corridor_id or tm.train_type in HARD_CONFLICT_TRAIN_TYPES:
            continue
        if _overlaps(start_time, end_time, tm.scheduled_start, tm.scheduled_end):
            overlap_start = max(start_time, tm.scheduled_start)
            overlap_end = min(end_time, tm.scheduled_end)
            delay_minutes += int((overlap_end - overlap_start).total_seconds() // 60)

    return True, None, delay_minutes


def generate_candidates(
    scenario: NormalizedScenario, bundle_pairs: tuple[BundlePair, ...]
) -> list[Candidate]:
    tasks_by_id = {t.id: t for t in scenario.tasks}
    windows_by_corridor: dict[str, list[BlockWindow]] = defaultdict(list)
    for w in scenario.block_windows:
        windows_by_corridor[w.corridor_id].append(w)

    groups: list[tuple[bool, tuple[str, ...]]] = [(False, (t.id,)) for t in scenario.tasks]
    groups += [(True, (bp.task_a_id, bp.task_b_id)) for bp in bundle_pairs]

    raw_candidates: list[Candidate] = []
    seq = 0
    for is_bundle, task_ids in groups:
        group_tasks = [tasks_by_id[tid] for tid in task_ids]
        corridor_id = group_tasks[0].corridor_id
        for window in windows_by_corridor.get(corridor_id, []):
            seq += 1
            feasible, reason, delay = evaluate_candidate(
                group_tasks, window, scenario.resources_by_id, scenario.train_movements, scenario.compatibility_rules
            )
            start_time = window.start_time
            end_time = start_time + timedelta(minutes=_required_duration_minutes(group_tasks))
            raw_candidates.append(
                Candidate(
                    id=f"cand-{seq}",
                    task_ids=tuple(task_ids),
                    is_bundle=is_bundle,
                    corridor_id=corridor_id,
                    block_window_id=window.id,
                    start_time=start_time,
                    end_time=end_time,
                    feasible=feasible,
                    rejection_reason=reason,
                    estimated_delay_minutes=delay,
                )
            )

    return _apply_dependency_feasibility(raw_candidates, scenario)


def _apply_dependency_feasibility(candidates: list[Candidate], scenario: NormalizedScenario) -> list[Candidate]:
    candidates_by_task: dict[str, list[Candidate]] = defaultdict(list)
    for c in candidates:
        for tid in c.task_ids:
            candidates_by_task[tid].append(c)

    predecessors_by_successor: dict[str, list[str]] = defaultdict(list)
    for dep in scenario.dependencies:
        predecessors_by_successor[dep.successor_id].append(dep.predecessor_id)

    if not predecessors_by_successor:
        return candidates

    result: list[Candidate] = []
    for c in candidates:
        if not c.feasible:
            result.append(c)
            continue

        violates = False
        for tid in c.task_ids:
            for pred_id in predecessors_by_successor.get(tid, []):
                pred_candidates = [pc for pc in candidates_by_task.get(pred_id, []) if pc.feasible]
                if not any(pc.end_time <= c.start_time for pc in pred_candidates):
                    violates = True
                    break
            if violates:
                break

        result.append(replace(c, feasible=False, rejection_reason="DEPENDENCY_NOT_FEASIBLE") if violates else c)

    return result
