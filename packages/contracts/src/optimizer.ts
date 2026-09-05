// JSON contract exchanged with services/optimizer over stdin/stdout.
// Mirrored in Python as pydantic models in services/optimizer/src/schemas.py.
// Both sides are checked against shared fixtures in packages/test-fixtures/optimizer.

import {
  CandidateRejectionReason,
  Department,
  IsolationType,
  PowerRequirement,
  PriorityBreakdown,
  RequiredResource,
  StrategyType,
  TrainType,
  WorkType,
} from "./domain";

export interface OptimizerCorridorInput {
  id: string;
  code: string;
}

export interface OptimizerMaintenanceRequestInput {
  id: string;
  department: Department;
  assetId: string;
  assetCriticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  corridorId: string;
  segmentId: string | null;
  workType: WorkType;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string; // ISO8601
  estimatedDurationMinutes: number;
  requiredIsolation: IsolationType;
  requiredPower: PowerRequirement;
  requiredResources: RequiredResource[];
  status: string;
}

export interface OptimizerDependencyInput {
  predecessorId: string;
  successorId: string;
}

export interface OptimizerCompatibilityRuleInput {
  workTypeA: WorkType;
  workTypeB: WorkType;
  department: Department | null;
  compatible: boolean;
}

export interface OptimizerBlockWindowInput {
  id: string;
  corridorId: string;
  segmentId: string | null;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  permittedDepartments: Department[];
  allowsIsolationTypes: IsolationType[];
  allowsPowerTypes: PowerRequirement[];
  maxConcurrentResources: number | null;
}

export interface OptimizerTrainMovementInput {
  id: string;
  trainNumber: string;
  trainType: TrainType;
  corridorId: string;
  segmentId: string | null;
  trackResourceId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  priority: number;
}

export interface OptimizerConfigInput {
  priorityWeights: Record<string, number>;
  objectiveWeights: Record<string, number>;
}

export interface OptimizerOptions {
  timeLimitSeconds: number;
  randomSeed: number;
}

export interface OptimizerRunInput {
  scenarioId: string;
  strategy: StrategyType;
  configVersion: string;
  corridors: OptimizerCorridorInput[];
  maintenanceRequests: OptimizerMaintenanceRequestInput[];
  requestDependencies: OptimizerDependencyInput[];
  taskCompatibilityRules: OptimizerCompatibilityRuleInput[];
  blockWindows: OptimizerBlockWindowInput[];
  trainMovements: OptimizerTrainMovementInput[];
  config: OptimizerConfigInput;
  options: OptimizerOptions;
}

export interface OptimizerCandidate {
  id: string;
  taskIds: string[];
  isBundle: boolean;
  corridorId: string;
  blockWindowId: string;
  startTime: string;
  endTime: string;
  feasible: boolean;
  rejectionReason: CandidateRejectionReason | null;
  estimatedDelayMinutes: number;
}

export interface OptimizerPlanBlock {
  blockWindowId: string;
  corridorId: string;
  startTime: string;
  endTime: string;
  isBundle: boolean;
  department: Department | null;
  taskIds: string[];
}

export interface OptimizerTaskOutcome {
  maintenanceRequestId: string;
  scheduled: boolean;
  priorityScore: number;
  priorityBreakdown: PriorityBreakdown;
  reasons: string[];
  rejectionReason: CandidateRejectionReason | null;
}

export interface OptimizerDiagnostics {
  candidateCount: number;
  feasibleCandidateCount: number;
  rejectedCandidateCount: number;
  solveTimeMs: number;
}

export interface OptimizerRunOutput {
  status: "SUCCEEDED" | "FAILED" | "NO_FEASIBLE_PLAN";
  solverStatus: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "N_A_GREEDY";
  objectiveValue: number;
  objectiveBreakdown: Record<string, number>;
  candidates: OptimizerCandidate[];
  selectedCandidateIds: string[];
  planBlocks: OptimizerPlanBlock[];
  taskOutcomes: OptimizerTaskOutcome[];
  diagnostics: OptimizerDiagnostics;
  errorMessage: string | null;
}
