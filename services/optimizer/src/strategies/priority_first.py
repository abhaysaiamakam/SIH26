"""PRIORITY_FIRST: greedy, but candidates are offered to the acceptance
loop in descending order of priority (sum of member tasks' priority
scores), tie-broken deterministically by candidate id. Otherwise identical
machinery to FIRST_FEASIBLE - same candidate list, same conflict predicate.
"""

from __future__ import annotations

from ..core.candidates import Candidate
from ..core.greedy import greedy_select
from ..core.models import NormalizedScenario
from ..core.priority_engine import compute_priority


def run(scenario: NormalizedScenario, candidates: list[Candidate], priority_weights: dict) -> set[str]:
    tasks_by_id = {t.id: t for t in scenario.tasks}
    priority_by_task = {t.id: compute_priority(t, scenario.as_of, priority_weights).score for t in scenario.tasks}

    def candidate_priority(c: Candidate) -> float:
        return sum(priority_by_task[tid] for tid in c.task_ids)

    ordered = sorted(candidates, key=lambda c: (-candidate_priority(c), c.id))
    return greedy_select(ordered, tasks_by_id, scenario.resources_by_id, scenario.dependencies)
