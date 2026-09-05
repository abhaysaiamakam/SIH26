// Shared domain enums and value types for RAILOPT AI.
// These mirror apps/api/prisma/schema.prisma and are the vocabulary used
// across API DTOs, the optimizer/simulator JSON contracts, and the frontend.
// Keep in sync with the Prisma schema by hand (no codegen) - contract
// fixture tests in packages/test-fixtures catch drift.

export type Department = "ENGINEERING" | "TRD" | "S_AND_T";

export type WorkType =
  | "TRACK_RENEWAL"
  | "RAIL_GRINDING"
  | "BALLAST_CLEANING"
  | "POINTS_CROSSING_MAINTENANCE"
  | "BRIDGE_INSPECTION"
  | "SIGNAL_MAINTENANCE"
  | "INTERLOCKING_UPGRADE"
  | "OHE_MAINTENANCE"
  | "TRACTION_SUBSTATION_MAINTENANCE"
  | "GENERAL_INSPECTION";

export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MaintenanceStatus =
  | "OPEN"
  | "VERIFIED"
  | "PRIORITIZED"
  | "BLOCK_REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED";

export type IsolationType =
  | "NONE"
  | "TRACK_ISOLATION"
  | "POWER_ISOLATION"
  | "SIGNAL_ISOLATION"
  | "FULL_ISOLATION";

export type PowerRequirement = "NONE" | "TRACTION_POWER_OFF" | "AUXILIARY_POWER" | "LOW_VOLTAGE";

export type ResourceType = "MACHINE" | "CREW" | "MATERIAL" | "TOOL";

export type TrainType = "PASSENGER" | "EXPRESS" | "GOODS" | "SUBURBAN";

export type StrategyType = "FIRST_FEASIBLE" | "PRIORITY_FIRST" | "OPTIMIZED";

export type PlanStatus = "DRAFT" | "VALIDATED" | "INVALID" | "APPROVED" | "REJECTED" | "SUPERSEDED";

export type PlanningRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type ValidationStatus = "VALID" | "INVALID";

export type ViolationSeverity = "WARNING" | "ERROR" | "CRITICAL";

export type ApprovalDecisionType = "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION";

export type Role =
  | "FIELD_ENGINEER"
  | "DEPARTMENT_PLANNER"
  | "DIVISIONAL_PLANNER"
  | "CONTROL_OPERATOR"
  | "MANAGEMENT"
  | "ADMIN";

export const CANDIDATE_REJECTION_REASONS = [
  "INSUFFICIENT_WINDOW_DURATION",
  "RESOURCE_UNAVAILABLE",
  "CORRIDOR_MISMATCH",
  "ISOLATION_MISMATCH",
  "POWER_REQUIREMENT_UNAVAILABLE",
  "OPERATIONAL_CONFLICT",
  "INCOMPATIBLE_WORK_TYPES",
  "DEPENDENCY_NOT_FEASIBLE",
] as const;
export type CandidateRejectionReason = (typeof CANDIDATE_REJECTION_REASONS)[number];

export const SCENARIO_EVENT_TYPES = [
  "CORRIDOR_UNAVAILABLE",
  "NEW_CRITICAL_REQUEST",
  "BLOCK_WINDOW_SHORTENED",
  "ADDITIONAL_TRAIN_MOVEMENT",
  "TASK_BECOMES_OVERDUE",
] as const;
export type ScenarioEventType = (typeof SCENARIO_EVENT_TYPES)[number];

export type ScenarioEventSource = "SYNTHETIC" | "WHAT_IF";

/** Label required on every simulated/assumption-based value shown to a user. */
export const SIMULATION_ASSUMPTION_LABEL = "SIMULATION ASSUMPTION — NOT A PRODUCTION RAILWAY RULE";

export interface RequiredResource {
  resourceId: string;
  quantity: number;
}

export interface PriorityBreakdown {
  assetCriticality: number;
  maintenanceCriticality: number;
  urgency: number;
  overdue: number;
  dueSoon: number;
  total: number;
}
