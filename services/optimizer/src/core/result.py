"""Builds the final result (objective value/breakdown, plan blocks, and
per-task WHY SCHEDULED / WHY NOT SCHEDULED explanations) from a selected
candidate id set. Used identically by all three strategies so their
results are directly comparable - the only thing that differs between
strategies is which candidate ids end up selected.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .candidates import Candidate
from .models import BlockWindow, NormalizedScenario
from .priority_engine import PriorityResult, compute_priority


@dataclass(frozen=True)
class PlanBlockResult:
    block_window_id: str
    corridor_id: str
    start_time: str
    end_time: str
    is_bundle: bool
    department: Optional[str]
    task_ids: tuple[str, ...]


@dataclass(frozen=True)
class TaskOutcome:
    maintenance_request_id: str
    scheduled: bool
    priority_score: float
    priority_breakdown: dict[str, float]
    reasons: tuple[str, ...]
    rejection_reason: Optional[str]


@dataclass(frozen=True)
class OptimizationResult:
    objective_value: float
    objective_breakdown: dict[str, float]
    plan_blocks: tuple[PlanBlockResult, ...]
    task_outcomes: tuple[TaskOutcome, ...]
    selected_candidate_ids: tuple[str, ...]
    diagnostics: dict[str, Any] = field(default_factory=dict)


def _duration_minutes(candidate: Candidate) -> float:
    return (candidate.end_time - candidate.start_time).total_seconds() / 60.0


def build_result(
    scenario: NormalizedScenario,
    all_candidates: list[Candidate],
    selected_ids: set[str],
    priority_weights: dict[str, Any],
    objective_weights: dict[str, Any],
) -> OptimizationResult:
    tasks_by_id = {t.id: t for t in scenario.tasks}
    windows_by_id: dict[str, BlockWindow] = {w.id: w for w in scenario.block_windows}
    candidates_by_id = {c.id: c for c in all_candidates}
    selected = [candidates_by_id[cid] for cid in selected_ids]

    priority_by_task: dict[str, PriorityResult] = {
        t.id: compute_priority(t, scenario.as_of, priority_weights) for t in scenario.tasks
    }

    scheduled_task_ids: set[str] = set()
    candidate_by_task: dict[str, Candidate] = {}
    for c in selected:
        for tid in c.task_ids:
            scheduled_task_ids.add(tid)
            candidate_by_task[tid] = c

    priority_realized = 0.0
    bundle_bonus = 0.0
    asset_availability = 0.0
    block_utilization = 0.0
    delay_penalty = 0.0
    for c in selected:
        for tid in c.task_ids:
            priority_realized += priority_by_task[tid].score
            asset_availability += objective_weights["assetAvailabilityPoints"][tasks_by_id[tid].asset_criticality]
        if c.is_bundle:
            bundle_bonus += objective_weights["bundleBonusPerExtraTask"] * (len(c.task_ids) - 1)
        window = windows_by_id[c.block_window_id]
        block_utilization += objective_weights["blockUtilizationWeight"] * (_duration_minutes(c) / window.duration_minutes)
        delay_penalty += objective_weights["delayMinutePenalty"] * c.estimated_delay_minutes

    distinct_windows_used = {c.block_window_id for c in selected}
    block_used_penalty = objective_weights["blockUsedPenalty"] * len(distinct_windows_used)

    bundle_candidate_task_ids: set[str] = set()
    for c in all_candidates:
        if c.is_bundle:
            bundle_candidate_task_ids.update(c.task_ids)
    missed_bundle_count = sum(
        1
        for c in selected
        if not c.is_bundle
        for tid in c.task_ids
        if tid in bundle_candidate_task_ids
    )
    fragmentation_penalty = objective_weights["fragmentationPenaltyPerBlock"] * missed_bundle_count

    priority_weighted = priority_realized * objective_weights["priorityWeight"]
    objective_value = (
        priority_weighted + bundle_bonus + asset_availability + block_utilization - delay_penalty - block_used_penalty - fragmentation_penalty
    )

    breakdown = {
        "priorityRealized": priority_weighted,
        "bundleBonus": bundle_bonus,
        "assetAvailabilityBenefit": asset_availability,
        "blockUtilization": block_utilization,
        "delayPenalty": -delay_penalty,
        "blockUsedPenalty": -block_used_penalty,
        "fragmentationPenalty": -fragmentation_penalty,
    }

    candidates_by_task: dict[str, list[Candidate]] = {}
    for c in all_candidates:
        for tid in c.task_ids:
            candidates_by_task.setdefault(tid, []).append(c)

    task_outcomes: list[TaskOutcome] = []
    for t in scenario.tasks:
        pr = priority_by_task[t.id]
        scheduled = t.id in scheduled_task_ids
        reasons: list[str] = []
        rejection_reason: Optional[str] = None

        if scheduled:
            c = candidate_by_task[t.id]
            reasons.extend(pr.explanation)
            if c.is_bundle:
                other = next(tid for tid in c.task_ids if tid != t.id)
                reasons.append(f"Bundled with {other} (compatible, same window)")
            if c.estimated_delay_minutes > 0:
                reasons.append(f"Causes an estimated {c.estimated_delay_minutes} minute(s) of goods-train delay")
            else:
                reasons.append("No conflicting train movements")
        else:
            task_candidates = candidates_by_task.get(t.id, [])
            feasible_unselected = [c for c in task_candidates if c.feasible]
            if not task_candidates:
                reasons.append("No block window is available on this task's corridor")
            elif not feasible_unselected:
                rejection_reason = next((c.rejection_reason for c in task_candidates if c.rejection_reason), None)
                reasons.append(f"No feasible candidate window (dominant reason: {rejection_reason})")
            else:
                reasons.append(
                    "Feasible candidate window(s) existed but were not selected - "
                    "another higher-value or conflicting selection took priority"
                )

        task_outcomes.append(
            TaskOutcome(
                maintenance_request_id=t.id,
                scheduled=scheduled,
                priority_score=pr.score,
                priority_breakdown=pr.breakdown.to_dict(),
                reasons=tuple(reasons),
                rejection_reason=rejection_reason,
            )
        )

    plan_blocks: list[PlanBlockResult] = []
    for c in selected:
        departments = {tasks_by_id[tid].department for tid in c.task_ids}
        plan_blocks.append(
            PlanBlockResult(
                block_window_id=c.block_window_id,
                corridor_id=c.corridor_id,
                start_time=c.start_time.isoformat(),
                end_time=c.end_time.isoformat(),
                is_bundle=c.is_bundle,
                department=next(iter(departments)) if len(departments) == 1 else None,
                task_ids=c.task_ids,
            )
        )

    return OptimizationResult(
        objective_value=objective_value,
        objective_breakdown=breakdown,
        plan_blocks=tuple(plan_blocks),
        task_outcomes=tuple(task_outcomes),
        selected_candidate_ids=tuple(selected_ids),
    )
