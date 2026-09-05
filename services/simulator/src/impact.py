"""Deterministic traffic-impact estimation over a plan revision's blocks.

This is explicitly a PROTOTYPE approximation, not a production railway
traffic simulator: delay is modeled as the raw time-overlap between a
possession block and a train's scheduled window, with no route, speed,
signalling, or timetable-recovery model. Every assumption this makes is
returned in the `assumptions` list, each prefixed with
SIMULATION_ASSUMPTION_LABEL, so nothing here is ever presented as a real
operational guarantee.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

SIMULATION_ASSUMPTION_LABEL = "SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE"
HARD_CONFLICT_TRAIN_TYPES = {"PASSENGER", "EXPRESS", "SUBURBAN"}


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _overlap_minutes(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> float:
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    return max(0.0, (end - start).total_seconds() / 60.0)


def run_simulation(raw: dict[str, Any]) -> dict[str, Any]:
    blocks = raw.get("planBlocks", [])
    windows_by_id = {w["id"]: w for w in raw.get("blockWindows", [])}
    trains = raw.get("trainMovements", [])

    affected_movements: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    total_delay = 0.0
    impacted_train_ids: set[str] = set()

    for block in blocks:
        b_start = parse_iso(block["startTime"])
        b_end = parse_iso(block["endTime"])
        for tm in trains:
            if tm["corridorId"] != block["corridorId"]:
                continue
            t_start = parse_iso(tm["scheduledStart"])
            t_end = parse_iso(tm["scheduledEnd"])
            overlap = _overlap_minutes(b_start, b_end, t_start, t_end)
            if overlap <= 0:
                continue

            impacted_train_ids.add(tm["id"])
            total_delay += overlap
            is_hard = tm["trainType"] in HARD_CONFLICT_TRAIN_TYPES
            reason = (
                "Hard conflict: a passenger-carrying service overlaps an active possession"
                if is_hard
                else "Soft conflict: a goods service is delayed by an overlapping possession"
            )
            affected_movements.append(
                {
                    "trainMovementId": tm["id"],
                    "trainNumber": tm["trainNumber"],
                    "delayMinutes": int(overlap),
                    "reason": reason,
                }
            )
            if is_hard:
                conflicts.append(
                    {
                        "code": "HARD_OPERATIONAL_CONFLICT",
                        "description": (
                            f"Block on corridor {block['corridorId']} overlaps {tm['trainType']} "
                            f"train {tm['trainNumber']} - this should never occur in a VALID plan"
                        ),
                        "relatedBlockIds": [block.get("blockWindowId")],
                        "relatedTrainMovementIds": [tm["id"]],
                    }
                )

    block_utilization: list[dict[str, Any]] = []
    for block in blocks:
        window = windows_by_id.get(block["blockWindowId"])
        if not window:
            continue
        b_start = parse_iso(block["startTime"])
        b_end = parse_iso(block["endTime"])
        utilized = (b_end - b_start).total_seconds() / 60.0
        window_minutes = window["durationMinutes"]
        block_utilization.append(
            {
                "blockWindowId": block["blockWindowId"],
                "utilizedMinutes": int(utilized),
                "windowMinutes": window_minutes,
                "utilizationRatio": round(utilized / window_minutes, 4) if window_minutes else 0.0,
            }
        )

    assumptions = [
        f"{SIMULATION_ASSUMPTION_LABEL}: train delay is approximated as the full time-overlap between "
        "a possession block and the train's scheduled window - no route, speed, or signalling model is simulated.",
        f"{SIMULATION_ASSUMPTION_LABEL}: passenger/express/suburban overlaps are reported as hard operational "
        "conflicts (should not occur in a VALID plan); goods overlaps are treated as absorbable delay only.",
        f"{SIMULATION_ASSUMPTION_LABEL}: block utilization is computed only against the block's own window; "
        "cross-corridor network effects are not modeled.",
    ]

    return {
        "impactedTrainCount": len(impacted_train_ids),
        "totalDelayMinutes": int(total_delay),
        "affectedMovements": affected_movements,
        "conflicts": conflicts,
        "blockUtilization": block_utilization,
        "assumptions": assumptions,
    }
