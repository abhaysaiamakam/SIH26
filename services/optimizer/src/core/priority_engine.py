"""Deterministic, explainable priority scoring.

Score = assetCriticality + maintenanceCriticality + urgency + overdue + dueSoon,
using packages/config/v1/priority-weights.json. Every component is returned
alongside the total, plus a short natural-language explanation - never an
unexplained magic normalization.

CRITICAL RULE (see docs/OPTIMIZATION_MODEL.md): "overdue" is only ever a
POSITIVE addend here. It is never turned into a penalty anywhere in this
codebase - an unscheduled overdue task simply forgoes this positive reward,
it is never subtracted from anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from .models import Task


@dataclass(frozen=True)
class PriorityBreakdown:
    asset_criticality: float
    maintenance_criticality: float
    urgency: float
    overdue: float
    due_soon: float
    total: float

    def to_dict(self) -> dict[str, float]:
        return {
            "assetCriticality": self.asset_criticality,
            "maintenanceCriticality": self.maintenance_criticality,
            "urgency": self.urgency,
            "overdue": self.overdue,
            "dueSoon": self.due_soon,
            "total": self.total,
        }


@dataclass(frozen=True)
class PriorityResult:
    score: float
    breakdown: PriorityBreakdown
    explanation: tuple[str, ...]
    is_overdue: bool
    days_overdue: float
    days_until_due: float


def days_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 86_400.0


def compute_priority(task: Task, as_of: datetime, weights: dict[str, Any]) -> PriorityResult:
    days_until_due = days_between(as_of, task.due_date)
    is_overdue = days_until_due < 0
    days_overdue = max(0.0, -days_until_due)

    asset_points = weights["assetCriticalityPoints"][task.asset_criticality]
    maintenance_points = weights["maintenanceCriticalityPoints"][task.criticality]
    urgency_points = weights["urgencyPoints"][task.urgency]

    overdue_points = 0.0
    if is_overdue:
        overdue_cfg = weights["overdue"]
        overdue_points = min(
            overdue_cfg["baseBonus"] + overdue_cfg["perDayBonus"] * days_overdue,
            overdue_cfg["maxBonus"],
        )

    due_soon_points = 0.0
    if not is_overdue:
        for threshold in weights["dueSoon"]["thresholds"]:
            if days_until_due <= threshold["withinDays"]:
                due_soon_points = max(due_soon_points, threshold["bonus"])

    total = asset_points + maintenance_points + urgency_points + overdue_points + due_soon_points
    breakdown = PriorityBreakdown(
        asset_criticality=asset_points,
        maintenance_criticality=maintenance_points,
        urgency=urgency_points,
        overdue=overdue_points,
        due_soon=due_soon_points,
        total=total,
    )

    explanation: list[str] = []
    if task.asset_criticality in ("HIGH", "CRITICAL"):
        explanation.append(f"{task.asset_criticality.title()}-criticality asset")
    if task.criticality in ("HIGH", "CRITICAL"):
        explanation.append(f"{task.criticality.title()}-criticality maintenance")
    if task.urgency in ("HIGH", "CRITICAL"):
        explanation.append(f"{task.urgency.title()} urgency")
    if is_overdue:
        explanation.append(f"Overdue by {days_overdue:.0f} day(s)")
    elif due_soon_points > 0:
        explanation.append(f"Due in {days_until_due:.0f} day(s)")
    if not explanation:
        explanation.append("Routine maintenance with no elevated priority factors")

    return PriorityResult(
        score=total,
        breakdown=breakdown,
        explanation=tuple(explanation),
        is_overdue=is_overdue,
        days_overdue=days_overdue,
        days_until_due=max(0.0, days_until_due),
    )
