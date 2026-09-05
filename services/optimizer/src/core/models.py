"""Internal dataclasses used throughout the optimizer pipeline.

These mirror the JSON contract in packages/contracts/src/optimizer.ts
(OptimizerRunInput and friends) but as typed, datetime-aware Python objects -
normalization.py is what converts the raw JSON dict into these.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class RequiredResource:
    resource_id: str
    quantity: int


@dataclass(frozen=True)
class TrackResource:
    id: str
    code: str
    type: str
    corridor_id: Optional[str]
    capacity: int


@dataclass(frozen=True)
class Task:
    """A single maintenance request, normalized for the optimizer pipeline."""

    id: str
    department: str
    work_type: str
    corridor_id: str
    segment_id: Optional[str]
    asset_id: str
    asset_criticality: str
    criticality: str
    urgency: str
    due_date: datetime
    estimated_duration_minutes: int
    required_isolation: str
    required_power: str
    required_resources: tuple[RequiredResource, ...] = field(default_factory=tuple)
    status: str = "OPEN"


@dataclass(frozen=True)
class BlockWindow:
    id: str
    corridor_id: str
    segment_id: Optional[str]
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    permitted_departments: tuple[str, ...]
    allows_isolation_types: tuple[str, ...]
    allows_power_types: tuple[str, ...]
    max_concurrent_resources: Optional[int]


@dataclass(frozen=True)
class TrainMovement:
    id: str
    train_number: str
    train_type: str
    corridor_id: str
    segment_id: Optional[str]
    scheduled_start: datetime
    scheduled_end: datetime
    priority: int


@dataclass(frozen=True)
class Dependency:
    predecessor_id: str
    successor_id: str


@dataclass(frozen=True)
class CompatibilityRule:
    work_type_a: str
    work_type_b: str
    department: Optional[str]
    compatible: bool
    reason: str = ""


@dataclass(frozen=True)
class NormalizedScenario:
    scenario_id: str
    strategy: str
    config_version: str
    as_of: datetime
    tasks: tuple[Task, ...]
    dependencies: tuple[Dependency, ...]
    compatibility_rules: tuple[CompatibilityRule, ...]
    block_windows: tuple[BlockWindow, ...]
    train_movements: tuple[TrainMovement, ...]
    resources_by_id: dict[str, TrackResource]
