"""Parses the raw OptimizerRunInput JSON dict (see
packages/contracts/src/optimizer.ts) into the typed dataclasses in models.py.
This is the single place ISO8601 strings get parsed into datetimes, so every
downstream engine works with real datetime objects.
"""

from __future__ import annotations

from datetime import datetime

from .models import (
    BlockWindow,
    CompatibilityRule,
    Dependency,
    NormalizedScenario,
    RequiredResource,
    Task,
    TrackResource,
    TrainMovement,
)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize(raw: dict) -> NormalizedScenario:
    tasks = tuple(
        Task(
            id=t["id"],
            department=t["department"],
            work_type=t["workType"],
            corridor_id=t["corridorId"],
            segment_id=t.get("segmentId"),
            asset_id=t["assetId"],
            asset_criticality=t["assetCriticality"],
            criticality=t["criticality"],
            urgency=t["urgency"],
            due_date=parse_iso(t["dueDate"]),
            estimated_duration_minutes=t["estimatedDurationMinutes"],
            required_isolation=t.get("requiredIsolation", "NONE"),
            required_power=t.get("requiredPower", "NONE"),
            required_resources=tuple(
                RequiredResource(resource_id=r["resourceId"], quantity=r["quantity"])
                for r in t.get("requiredResources", [])
            ),
            status=t.get("status", "OPEN"),
        )
        for t in raw["maintenanceRequests"]
    )

    dependencies = tuple(
        Dependency(predecessor_id=d["predecessorId"], successor_id=d["successorId"])
        for d in raw.get("requestDependencies", [])
    )

    compatibility_rules = tuple(
        CompatibilityRule(
            work_type_a=r["workTypeA"],
            work_type_b=r["workTypeB"],
            department=r.get("department"),
            compatible=r["compatible"],
            reason=r.get("reason", ""),
        )
        for r in raw.get("taskCompatibilityRules", [])
    )

    block_windows = tuple(
        BlockWindow(
            id=w["id"],
            corridor_id=w["corridorId"],
            segment_id=w.get("segmentId"),
            start_time=parse_iso(w["startTime"]),
            end_time=parse_iso(w["endTime"]),
            duration_minutes=w["durationMinutes"],
            permitted_departments=tuple(w["permittedDepartments"]),
            allows_isolation_types=tuple(w["allowsIsolationTypes"]),
            allows_power_types=tuple(w["allowsPowerTypes"]),
            max_concurrent_resources=w.get("maxConcurrentResources"),
        )
        for w in raw.get("blockWindows", [])
    )

    train_movements = tuple(
        TrainMovement(
            id=tm["id"],
            train_number=tm["trainNumber"],
            train_type=tm["trainType"],
            corridor_id=tm["corridorId"],
            segment_id=tm.get("segmentId"),
            scheduled_start=parse_iso(tm["scheduledStart"]),
            scheduled_end=parse_iso(tm["scheduledEnd"]),
            priority=tm["priority"],
        )
        for tm in raw.get("trainMovements", [])
    )

    resources_by_id = {
        r["id"]: TrackResource(
            id=r["id"],
            code=r.get("code", r["id"]),
            type=r.get("type", "MACHINE"),
            corridor_id=r.get("corridorId"),
            capacity=r.get("capacity", 1),
        )
        for r in raw.get("trackResources", [])
    }

    return NormalizedScenario(
        scenario_id=raw["scenarioId"],
        strategy=raw["strategy"],
        config_version=raw["configVersion"],
        as_of=parse_iso(raw["options"]["asOf"]),
        tasks=tasks,
        dependencies=dependencies,
        compatibility_rules=compatibility_rules,
        block_windows=block_windows,
        train_movements=train_movements,
        resources_by_id=resources_by_id,
    )
