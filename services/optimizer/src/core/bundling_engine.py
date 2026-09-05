"""Identifies pairs of maintenance tasks that can be performed in one
coordinated block, using the compatibility engine. Only same-corridor,
pairwise-compatible, cross-department pairs are considered bundling
candidates - same-department pairs are left to run as separate solo
candidates even when compatible, since bundling's value proposition here is
specifically fewer blocks across departments (a same-department planner can
already sequence their own work within one possession without "bundling").

Kept deliberately to pairs (not larger cliques) - every example in the
project brief bundles exactly two tasks, and larger cliques add
combinatorial complexity with no demonstrated benefit at this scale.
"""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Any

from .compatibility_engine import CompatibilityResult, check_compatibility
from .models import CompatibilityRule, Task, TrackResource


@dataclass(frozen=True)
class BundlePair:
    task_a_id: str
    task_b_id: str
    result: CompatibilityResult


def find_bundle_pairs(
    tasks: tuple[Task, ...],
    resources_by_id: dict[str, TrackResource],
    rules: tuple[CompatibilityRule, ...],
    defaults: dict[str, Any],
) -> tuple[BundlePair, ...]:
    bundles: list[BundlePair] = []
    for task_a, task_b in combinations(tasks, 2):
        if task_a.corridor_id != task_b.corridor_id:
            continue
        if task_a.department == task_b.department:
            continue
        result = check_compatibility(task_a, task_b, resources_by_id, rules, defaults)
        if result.compatible:
            bundles.append(BundlePair(task_a_id=task_a.id, task_b_id=task_b.id, result=result))
    return tuple(bundles)
