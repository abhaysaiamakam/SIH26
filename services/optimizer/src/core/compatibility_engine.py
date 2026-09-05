"""Explainable pairwise compatibility between two maintenance tasks.

Tasks are NOT considered compatible merely because they share a corridor.
Evaluation order (first match wins):
  1. An explicit TaskCompatibilityRule (department=None applies regardless
     of which departments the two tasks belong to; a set department only
     applies when BOTH tasks belong to that department) - explicit rules
     always take precedence over the heuristic defaults below.
  2. A hard incompatible pair (packages/config's hardIncompatiblePairs) -
     applies regardless of department combination.
  3. Same department: sameDepartmentIncompatiblePairs, else
     sameDepartmentDefaultCompatible.
  4. Cross department: crossDepartmentAllowList, else
     crossDepartmentDefaultCompatible.

Resource sufficiency (can both tasks' resource needs be met concurrently
from the same pool) and corridor match are checked independently and
combined into the final verdict, each contributing its own reason string.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from .models import CompatibilityRule, Task, TrackResource


@dataclass(frozen=True)
class CompatibilityResult:
    compatible: bool
    reasons: tuple[str, ...]
    same_corridor: bool
    work_types_compatible: bool
    resource_conflict: bool


def _pair_matches(work_type_a: str, work_type_b: str, a: str, b: str) -> bool:
    return {work_type_a, work_type_b} == {a, b}


def _find_explicit_rule(
    task_a: Task, task_b: Task, rules: tuple[CompatibilityRule, ...]
) -> Optional[CompatibilityRule]:
    for rule in rules:
        if not _pair_matches(rule.work_type_a, rule.work_type_b, task_a.work_type, task_b.work_type):
            continue
        if rule.department is None:
            return rule
        if task_a.department == rule.department and task_b.department == rule.department:
            return rule
    return None


def _check_work_type_compatibility(
    task_a: Task, task_b: Task, rules: tuple[CompatibilityRule, ...], defaults: dict[str, Any]
) -> tuple[bool, str]:
    explicit = _find_explicit_rule(task_a, task_b, rules)
    if explicit is not None:
        verdict = "compatible" if explicit.compatible else "incompatible"
        return explicit.compatible, f"Explicit rule marks {task_a.work_type} + {task_b.work_type} as {verdict}: {explicit.reason}"

    for pair in defaults.get("hardIncompatiblePairs", []):
        if _pair_matches(pair["workTypeA"], pair["workTypeB"], task_a.work_type, task_b.work_type):
            return False, f"Hard incompatible work types: {pair['reason']}"

    if task_a.department == task_b.department:
        for pair in defaults.get("sameDepartmentIncompatiblePairs", []):
            if _pair_matches(pair["workTypeA"], pair["workTypeB"], task_a.work_type, task_b.work_type):
                return False, f"Same-department incompatible work types: {pair['reason']}"
        if defaults.get("sameDepartmentDefaultCompatible", True):
            return True, "Same department, compatible work types by default"
        return False, "Same department, but no rule permits combining these work types"

    for pair in defaults.get("crossDepartmentAllowList", []):
        if _pair_matches(pair["workTypeA"], pair["workTypeB"], task_a.work_type, task_b.work_type):
            return True, f"Cross-department compatible: {pair['reason']}"
    if defaults.get("crossDepartmentDefaultCompatible", False):
        return True, "Cross-department, compatible work types by default"
    return False, "Cross-department work types require an explicit compatibility rule or allow-list entry"


def _check_resource_sufficiency(
    task_a: Task, task_b: Task, resources_by_id: dict[str, TrackResource]
) -> tuple[bool, Optional[str]]:
    demand_b = {r.resource_id: r.quantity for r in task_b.required_resources}
    for req_a in task_a.required_resources:
        if req_a.resource_id not in demand_b:
            continue
        resource = resources_by_id.get(req_a.resource_id)
        capacity = resource.capacity if resource else 1
        combined = req_a.quantity + demand_b[req_a.resource_id]
        if combined > capacity:
            name = resource.code if resource else req_a.resource_id
            return False, f"Resource conflict: {name} needs {combined} but only has capacity {capacity}"
    return True, None


def check_compatibility(
    task_a: Task,
    task_b: Task,
    resources_by_id: dict[str, TrackResource],
    rules: tuple[CompatibilityRule, ...],
    defaults: dict[str, Any],
) -> CompatibilityResult:
    reasons: list[str] = []

    same_corridor = task_a.corridor_id == task_b.corridor_id
    reasons.append("same corridor" if same_corridor else "different corridors")

    work_types_compatible, work_type_reason = _check_work_type_compatibility(task_a, task_b, rules, defaults)
    reasons.append(work_type_reason)

    resource_ok, resource_reason = _check_resource_sufficiency(task_a, task_b, resources_by_id)
    if resource_reason:
        reasons.append(resource_reason)
    else:
        reasons.append("no resource conflict")

    compatible = same_corridor and work_types_compatible and resource_ok
    return CompatibilityResult(
        compatible=compatible,
        reasons=tuple(reasons),
        same_corridor=same_corridor,
        work_types_compatible=work_types_compatible,
        resource_conflict=not resource_ok,
    )
