"""Shared greedy acceptance loop used by FIRST_FEASIBLE and PRIORITY_FIRST -
both strategies choose from the exact same candidate list and use the exact
same conflict predicate (core/conflicts.py); they differ only in the order
candidates are offered to the loop.
"""

from __future__ import annotations

from typing import Callable

from .candidates import Candidate
from .conflicts import candidates_conflict
from .models import Dependency, Task, TrackResource


def greedy_select(
    ordered_candidates: list[Candidate],
    tasks_by_id: dict[str, Task],
    resources_by_id: dict[str, TrackResource],
    dependencies: tuple[Dependency, ...],
) -> set[str]:
    accepted: list[Candidate] = []
    selected_ids: set[str] = set()

    for candidate in ordered_candidates:
        if not candidate.feasible:
            continue
        if any(candidates_conflict(candidate, other, tasks_by_id, resources_by_id, dependencies) for other in accepted):
            continue
        accepted.append(candidate)
        selected_ids.add(candidate.id)

    return selected_ids
