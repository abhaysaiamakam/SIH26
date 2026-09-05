"""FIRST_FEASIBLE: the deterministic baseline strategy. Accepts candidates
in the order they were generated (task order, then window order - both
already deterministic from the input), taking the first non-conflicting one
for each task. No notion of priority at all - this is what RAILOPT
OPTIMIZED is compared against to show the value of optimization.
"""

from __future__ import annotations

from ..core.candidates import Candidate
from ..core.greedy import greedy_select
from ..core.models import NormalizedScenario


def run(scenario: NormalizedScenario, candidates: list[Candidate]) -> set[str]:
    tasks_by_id = {t.id: t for t in scenario.tasks}
    return greedy_select(candidates, tasks_by_id, scenario.resources_by_id, scenario.dependencies)
