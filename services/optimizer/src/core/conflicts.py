"""The single conflict predicate shared by all three strategies (and by the
CP-SAT pairwise constraints) - this is what guarantees FIRST_FEASIBLE,
PRIORITY_FIRST, and OPTIMIZED are comparable: they all accept/reject
candidate pairs using the exact same rule, differing only in *selection
order* (or, for OPTIMIZED, in solving instead of greedily choosing).
"""

from __future__ import annotations

from collections import defaultdict

from .candidates import Candidate
from .models import Dependency, Task, TrackResource


def _resource_demand(task_ids: tuple[str, ...], tasks_by_id: dict[str, Task]) -> dict[str, int]:
    demand: dict[str, int] = defaultdict(int)
    for tid in task_ids:
        for r in tasks_by_id[tid].required_resources:
            demand[r.resource_id] += r.quantity
    return demand


def _time_overlap(a: Candidate, b: Candidate) -> bool:
    return a.start_time < b.end_time and b.start_time < a.end_time


def candidates_conflict(
    a: Candidate,
    b: Candidate,
    tasks_by_id: dict[str, Task],
    resources_by_id: dict[str, TrackResource],
    dependencies: tuple[Dependency, ...],
) -> bool:
    if a.id == b.id:
        return False

    # Same task appearing in both (solo vs. bundle, or two different
    # bundles) - mutually exclusive regardless of timing.
    if set(a.task_ids) & set(b.task_ids):
        return True

    if _time_overlap(a, b):
        demand_a = _resource_demand(a.task_ids, tasks_by_id)
        demand_b = _resource_demand(b.task_ids, tasks_by_id)
        for resource_id in set(demand_a) & set(demand_b):
            resource = resources_by_id.get(resource_id)
            capacity = resource.capacity if resource else 1
            if demand_a[resource_id] + demand_b[resource_id] > capacity:
                return True

    for dep in dependencies:
        if dep.predecessor_id in a.task_ids and dep.successor_id in b.task_ids and a.end_time > b.start_time:
            return True
        if dep.predecessor_id in b.task_ids and dep.successor_id in a.task_ids and b.end_time > a.start_time:
            return True

    return False
