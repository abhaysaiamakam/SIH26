// Hand-written mirrors of the JSON shapes apps/api actually returns (not
// imported from @prisma/client - the frontend only ever talks to the API,
// never the database, so it doesn't need Prisma's types either).

export type Department = "ENGINEERING" | "TRD" | "S_AND_T";
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
export type StrategyType = "FIRST_FEASIBLE" | "PRIORITY_FIRST" | "OPTIMIZED";
export type PlanStatus = "DRAFT" | "VALIDATED" | "INVALID" | "APPROVED" | "REJECTED" | "SUPERSEDED";
export type PlanningRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
export type Role =
  | "FIELD_ENGINEER"
  | "DEPARTMENT_PLANNER"
  | "DIVISIONAL_PLANNER"
  | "CONTROL_OPERATOR"
  | "MANAGEMENT"
  | "ADMIN";

export interface Division {
  id: string;
  code: string;
  name: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface CorridorSegment {
  id: string;
  corridorId: string;
  sequenceNumber: number;
  name: string;
  startChainageKm: number;
  endChainageKm: number;
}

export interface Corridor {
  id: string;
  code: string;
  name: string;
  divisionId: string;
  division?: Division;
  originStation?: Station;
  destinationStation?: Station;
  totalLengthKm: number;
  segments?: CorridorSegment[];
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  assetType: string;
  corridorId: string;
  corridor?: Corridor;
  segmentId: string | null;
  criticality: Criticality;
  installDate: string;
  lastMaintenanceDate: string | null;
  maintenanceRequests?: MaintenanceRequest[];
}

export interface RequiredResource {
  trackResourceId: string;
  quantity: number;
  trackResource?: { id: string; code: string; name: string; type: string; capacity: number };
}

export interface MaintenanceRequest {
  id: string;
  requestNumber: string;
  department: Department;
  assetId: string;
  asset?: Asset;
  corridorId: string;
  corridor?: Corridor;
  segmentId: string | null;
  workType: string;
  description: string;
  criticality: Criticality;
  urgency: Criticality;
  dueDate: string;
  estimatedDurationMinutes: number;
  requiredIsolation: string;
  requiredPower: string;
  status: MaintenanceStatus;
  scenarioId: string;
  overdue?: boolean;
  requiredResources?: RequiredResource[];
  dependsOn?: MaintenanceRequest[];
  blockedFor?: MaintenanceRequest[];
}

export interface BlockWindow {
  id: string;
  corridorId: string;
  corridor?: Corridor;
  segmentId: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  permittedDepartments: Department[];
  allowsIsolationTypes: string[];
  allowsPowerTypes: string[];
  maxConcurrentResources: number | null;
  operationalRestrictions: string | null;
}

export interface TrainMovement {
  id: string;
  trainNumber: string;
  trainType: "PASSENGER" | "EXPRESS" | "GOODS" | "SUBURBAN";
  corridorId: string;
  corridor?: Corridor;
  scheduledStart: string;
  scheduledEnd: string;
  priority: number;
}

export interface PlanningScenario {
  id: string;
  name: string;
  seed: number;
  description: string;
  configVersion: string;
  generatedAt: string;
}

export interface PlanningRun {
  id: string;
  scenarioId: string;
  strategy: StrategyType;
  status: PlanningRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  solverStatus: string | null;
  objectiveValue: number | null;
  candidateCount: number | null;
  feasibleCandidateCount: number | null;
  rejectedCandidateCount: number | null;
  solveTimeMs: number | null;
  resultPlanId: string | null;
  errorMessage: string | null;
}

export interface PriorityBreakdown {
  assetCriticality: number;
  maintenanceCriticality: number;
  urgency: number;
  overdue: number;
  dueSoon: number;
  total: number;
}

export interface PlanTask {
  id: string;
  planRevisionId: string;
  planBlockId: string | null;
  maintenanceRequestId: string;
  maintenanceRequest?: MaintenanceRequest;
  scheduled: boolean;
  priorityScore: number;
  priorityBreakdown: PriorityBreakdown;
  reasons: string[];
  rejectionReason: string | null;
}

export interface PlanBlock {
  id: string;
  planRevisionId: string;
  blockWindowId: string;
  corridorId: string;
  startTime: string;
  endTime: string;
  department: Department | null;
  isBundle: boolean;
}

export interface ValidationViolation {
  code: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  relatedTaskIds: string[];
}

export interface ValidationRun {
  id: string;
  status: "VALID" | "INVALID";
  violations: ValidationViolation[];
  createdAt: string;
}

export interface SimulationRun {
  id: string;
  impactedTrainCount: number;
  totalDelayMinutes: number;
  affectedMovements: { trainMovementId: string; trainNumber: string; delayMinutes: number; reason: string }[];
  conflicts: { code: string; description: string; relatedBlockIds: string[]; relatedTrainMovementIds: string[] }[];
  blockUtilization: { blockWindowId: string; utilizedMinutes: number; windowMinutes: number; utilizationRatio: number }[];
  assumptions: string[];
  createdAt: string;
}

export interface ApprovalDecision {
  id: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION";
  comment: string | null;
  createdAt: string;
  decidedBy?: { id: string; name: string; email: string };
}

export interface PlanRevision {
  id: string;
  planId: string;
  revisionNumber: number;
  isImmutable: boolean;
  blocks: PlanBlock[];
  tasks: PlanTask[];
  validationRuns: ValidationRun[];
  simulationRuns: SimulationRun[];
  approvalDecisions: ApprovalDecision[];
}

export interface Plan {
  id: string;
  scenarioId: string;
  strategy: StrategyType;
  status: PlanStatus;
  objectiveValue: number | null;
  solverStatus: string | null;
  createdAt: string;
  revisions: PlanRevision[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
}

export interface WhatIfRunSummary {
  planId: string;
  status: string;
  objectiveValue: number;
  solverStatus: string;
  scheduledCount: number;
  totalCount: number;
  overdueScheduledCount: number;
  blocksUsed: number;
  bundleCount: number;
  totalDelayMinutes: number | null;
}

export interface WhatIfResult {
  scenarioEventId: string;
  eventType: string;
  strategy: StrategyType;
  before: WhatIfRunSummary;
  after: WhatIfRunSummary;
  delta: {
    objectiveValue: number;
    scheduledCount: number;
    overdueScheduledCount: number;
    bundleCount: number;
    blocksUsed: number;
    totalDelayMinutes: number | null;
  };
}
