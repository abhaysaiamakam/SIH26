"""Pydantic mirror of packages/contracts/src/optimizer.ts's OptimizerRunInput.

Field names intentionally match the wire-format JSON keys exactly (camelCase)
rather than idiomatic snake_case Python, since this module's only job is to
validate the JSON contract at the process boundary before anything else
touches it - "never call an invalid plan optimized," and equally, never let
a malformed input reach the optimization pipeline silently. On validation
failure, cli.py reports a clear FAILED result instead of a raw traceback.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

Criticality = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
Department = Literal["ENGINEERING", "TRD", "S_AND_T"]
IsolationType = Literal["NONE", "TRACK_ISOLATION", "POWER_ISOLATION", "SIGNAL_ISOLATION", "FULL_ISOLATION"]
PowerRequirement = Literal["NONE", "TRACTION_POWER_OFF", "AUXILIARY_POWER", "LOW_VOLTAGE"]
TrainType = Literal["PASSENGER", "EXPRESS", "GOODS", "SUBURBAN"]
StrategyType = Literal["FIRST_FEASIBLE", "PRIORITY_FIRST", "OPTIMIZED"]
WorkType = Literal[
    "TRACK_RENEWAL",
    "RAIL_GRINDING",
    "BALLAST_CLEANING",
    "POINTS_CROSSING_MAINTENANCE",
    "BRIDGE_INSPECTION",
    "SIGNAL_MAINTENANCE",
    "INTERLOCKING_UPGRADE",
    "OHE_MAINTENANCE",
    "TRACTION_SUBSTATION_MAINTENANCE",
    "GENERAL_INSPECTION",
]


class RequiredResourceInput(BaseModel):
    resourceId: str
    quantity: int


class CorridorInput(BaseModel):
    id: str
    code: str


class TrackResourceInput(BaseModel):
    id: str
    code: str
    type: str
    corridorId: Optional[str] = None
    capacity: int


class MaintenanceRequestInput(BaseModel):
    id: str
    department: Department
    assetId: str
    assetCriticality: Criticality
    corridorId: str
    segmentId: Optional[str] = None
    workType: WorkType
    criticality: Criticality
    urgency: Criticality
    dueDate: str
    estimatedDurationMinutes: int
    requiredIsolation: IsolationType = "NONE"
    requiredPower: PowerRequirement = "NONE"
    requiredResources: list[RequiredResourceInput] = []
    status: str = "OPEN"


class DependencyInput(BaseModel):
    predecessorId: str
    successorId: str


class CompatibilityRuleInput(BaseModel):
    workTypeA: WorkType
    workTypeB: WorkType
    department: Optional[Department] = None
    compatible: bool
    reason: Optional[str] = ""


class BlockWindowInput(BaseModel):
    id: str
    corridorId: str
    segmentId: Optional[str] = None
    startTime: str
    endTime: str
    durationMinutes: int
    permittedDepartments: list[Department]
    allowsIsolationTypes: list[IsolationType]
    allowsPowerTypes: list[PowerRequirement]
    maxConcurrentResources: Optional[int] = None


class TrainMovementInput(BaseModel):
    id: str
    trainNumber: str
    trainType: TrainType
    corridorId: str
    segmentId: Optional[str] = None
    trackResourceId: Optional[str] = None
    scheduledStart: str
    scheduledEnd: str
    priority: int


class OptimizerOptionsInput(BaseModel):
    timeLimitSeconds: float = 20
    randomSeed: int = 42
    asOf: str


class OptimizerRunInput(BaseModel):
    scenarioId: str
    strategy: StrategyType
    configVersion: str
    corridors: list[CorridorInput] = []
    trackResources: list[TrackResourceInput] = []
    maintenanceRequests: list[MaintenanceRequestInput]
    requestDependencies: list[DependencyInput] = []
    taskCompatibilityRules: list[CompatibilityRuleInput] = []
    blockWindows: list[BlockWindowInput] = []
    trainMovements: list[TrainMovementInput] = []
    options: OptimizerOptionsInput
