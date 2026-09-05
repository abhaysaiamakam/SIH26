#!/usr/bin/env python3
"""Stdin/stdout entrypoint invoked by apps/api's OptimizerClientService as a
subprocess. Reads one OptimizerRunInput JSON document from stdin, writes one
OptimizerRunOutput JSON document to stdout, and logs progress to stderr
(never mixed with the result). Exit code 0 = a result was produced (even a
NO_FEASIBLE_PLAN one - that's a valid outcome, not an error); non-zero =
something actually failed, with a human-readable message on stderr.

Usage: python3 -m src.cli < input.json > output.json
"""

from __future__ import annotations

import json
import sys
import time

from pydantic import ValidationError

from .core.bundling_engine import find_bundle_pairs
from .core.candidates import generate_candidates
from .core.config_loader import (
    load_compatibility_defaults,
    load_objective_weights,
    load_priority_weights,
    load_solver_settings,
)
from .core.normalization import normalize
from .core.result import build_result
from .schemas import OptimizerRunInput
from .strategies import first_feasible, optimized, priority_first


def run(raw: dict) -> dict:
    validated = OptimizerRunInput.model_validate(raw)
    scenario = normalize(validated.model_dump(mode="json"))

    priority_weights = load_priority_weights()
    objective_weights = load_objective_weights()
    compatibility_defaults = load_compatibility_defaults()
    solver_settings = load_solver_settings()

    start = time.perf_counter()

    bundle_pairs = find_bundle_pairs(scenario.tasks, scenario.resources_by_id, scenario.compatibility_rules, compatibility_defaults)
    candidates = generate_candidates(scenario, bundle_pairs)

    if scenario.strategy == "FIRST_FEASIBLE":
        selected_ids = first_feasible.run(scenario, candidates)
        solver_status = "N_A_GREEDY"
    elif scenario.strategy == "PRIORITY_FIRST":
        selected_ids = priority_first.run(scenario, candidates, priority_weights)
        solver_status = "N_A_GREEDY"
    elif scenario.strategy == "OPTIMIZED":
        selected_ids, solver_status = optimized.run(
            scenario,
            candidates,
            priority_weights,
            objective_weights,
            solver_settings,
            time_limit_seconds=validated.options.timeLimitSeconds,
        )
    else:
        raise ValueError(f"Unknown strategy: {scenario.strategy}")

    solve_time_ms = int((time.perf_counter() - start) * 1000)

    result = build_result(scenario, candidates, selected_ids, priority_weights, objective_weights)

    feasible_count = sum(1 for c in candidates if c.feasible)
    status = "SUCCEEDED"
    if scenario.tasks and not selected_ids:
        status = "NO_FEASIBLE_PLAN"

    return {
        "status": status,
        "solverStatus": solver_status,
        "objectiveValue": result.objective_value,
        "objectiveBreakdown": result.objective_breakdown,
        "candidates": [
            {
                "id": c.id,
                "taskIds": list(c.task_ids),
                "isBundle": c.is_bundle,
                "corridorId": c.corridor_id,
                "blockWindowId": c.block_window_id,
                "startTime": c.start_time.isoformat(),
                "endTime": c.end_time.isoformat(),
                "feasible": c.feasible,
                "rejectionReason": c.rejection_reason,
                "estimatedDelayMinutes": c.estimated_delay_minutes,
            }
            for c in candidates
        ],
        "selectedCandidateIds": sorted(selected_ids),
        "planBlocks": [
            {
                "blockWindowId": b.block_window_id,
                "corridorId": b.corridor_id,
                "startTime": b.start_time,
                "endTime": b.end_time,
                "isBundle": b.is_bundle,
                "department": b.department,
                "taskIds": list(b.task_ids),
            }
            for b in result.plan_blocks
        ],
        "taskOutcomes": [
            {
                "maintenanceRequestId": o.maintenance_request_id,
                "scheduled": o.scheduled,
                "priorityScore": o.priority_score,
                "priorityBreakdown": o.priority_breakdown,
                "reasons": list(o.reasons),
                "rejectionReason": o.rejection_reason,
            }
            for o in result.task_outcomes
        ],
        "diagnostics": {
            "candidateCount": len(candidates),
            "feasibleCandidateCount": feasible_count,
            "rejectedCandidateCount": len(candidates) - feasible_count,
            "solveTimeMs": solve_time_ms,
        },
        "errorMessage": None,
    }


def main() -> int:
    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON on stdin: {exc}", file=sys.stderr)
        return 1

    try:
        output = run(raw)
    except ValidationError as exc:
        print(f"Invalid OptimizerRunInput: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001 - top-level boundary, must never crash silently
        print(f"Optimizer run failed: {exc}", file=sys.stderr)
        return 1

    json.dump(output, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
