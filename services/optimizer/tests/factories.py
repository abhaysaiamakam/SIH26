"""Small builders for the dataclasses in core/models.py, used across the
Phase 3 test suite so each test only has to set the fields it cares about.
"""

from __future__ import annotations

from datetime import datetime, timezone

from src.core.models import BlockWindow, RequiredResource, Task, TrackResource

NOW = datetime(2026, 9, 5, tzinfo=timezone.utc)


def make_task(
    id: str,
    *,
    department: str = "ENGINEERING",
    work_type: str = "GENERAL_INSPECTION",
    corridor_id: str = "corridor-1",
    segment_id: str | None = None,
    asset_id: str = "asset-1",
    asset_criticality: str = "MEDIUM",
    criticality: str = "MEDIUM",
    urgency: str = "MEDIUM",
    due_date: datetime = NOW,
    estimated_duration_minutes: int = 60,
    required_isolation: str = "NONE",
    required_power: str = "NONE",
    required_resources: tuple[RequiredResource, ...] = (),
    status: str = "OPEN",
) -> Task:
    return Task(
        id=id,
        department=department,
        work_type=work_type,
        corridor_id=corridor_id,
        segment_id=segment_id,
        asset_id=asset_id,
        asset_criticality=asset_criticality,
        criticality=criticality,
        urgency=urgency,
        due_date=due_date,
        estimated_duration_minutes=estimated_duration_minutes,
        required_isolation=required_isolation,
        required_power=required_power,
        required_resources=required_resources,
        status=status,
    )


def make_window(
    id: str,
    *,
    corridor_id: str = "corridor-1",
    segment_id: str | None = None,
    start_time: datetime = NOW,
    duration_minutes: int = 240,
    permitted_departments: tuple[str, ...] = ("ENGINEERING", "TRD", "S_AND_T"),
    allows_isolation_types: tuple[str, ...] = ("TRACK_ISOLATION", "POWER_ISOLATION", "SIGNAL_ISOLATION", "FULL_ISOLATION"),
    allows_power_types: tuple[str, ...] = ("NONE", "TRACTION_POWER_OFF", "AUXILIARY_POWER", "LOW_VOLTAGE"),
    max_concurrent_resources: int | None = None,
) -> BlockWindow:
    from datetime import timedelta

    return BlockWindow(
        id=id,
        corridor_id=corridor_id,
        segment_id=segment_id,
        start_time=start_time,
        end_time=start_time + timedelta(minutes=duration_minutes),
        duration_minutes=duration_minutes,
        permitted_departments=permitted_departments,
        allows_isolation_types=allows_isolation_types,
        allows_power_types=allows_power_types,
        max_concurrent_resources=max_concurrent_resources,
    )


def make_resource(id: str, *, code: str | None = None, type: str = "CREW", corridor_id: str | None = None, capacity: int = 1) -> TrackResource:
    return TrackResource(id=id, code=code or id, type=type, corridor_id=corridor_id, capacity=capacity)
