import {
  CandidateRejectionReason,
  Department,
  IsolationType,
  PowerRequirement,
  ResourceType,
  ScenarioEventSource,
  ScenarioEventType,
  TrainType,
  WorkType,
} from "@railopt/contracts";

export interface GenDivision {
  id: string;
  code: string;
  name: string;
}

export interface GenStation {
  id: string;
  code: string;
  name: string;
  divisionId: string;
  latitude: number;
  longitude: number;
}

export interface GenCorridor {
  id: string;
  code: string;
  name: string;
  divisionId: string;
  originStationId: string;
  destinationStationId: string;
  totalLengthKm: number;
}

export interface GenCorridorSegment {
  id: string;
  corridorId: string;
  sequenceNumber: number;
  name: string;
  startChainageKm: number;
  endChainageKm: number;
}

export interface GenTrackResource {
  id: string;
  code: string;
  name: string;
  type: ResourceType;
  corridorId: string | null;
  capacity: number;
}

export interface GenAsset {
  id: string;
  code: string;
  name: string;
  assetType: string;
  corridorId: string;
  segmentId: string | null;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  installDate: string;
  lastMaintenanceDate: string | null;
}

export interface GenRequiredResource {
  trackResourceId: string;
  quantity: number;
}

export interface GenMaintenanceRequest {
  id: string;
  requestNumber: string;
  department: Department;
  assetId: string;
  corridorId: string;
  segmentId: string | null;
  workType: WorkType;
  description: string;
  criticality: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string;
  estimatedDurationMinutes: number;
  requiredIsolation: IsolationType;
  requiredPower: PowerRequirement;
  status: string;
  requiredResources: GenRequiredResource[];
  /** Tags describing which engineered scenario this request demonstrates - for tests/docs only, not persisted. */
  tags: string[];
}

export interface GenRequestDependency {
  predecessorId: string;
  successorId: string;
}

export interface GenTaskCompatibilityRule {
  workTypeA: WorkType;
  workTypeB: WorkType;
  department: Department | null;
  compatible: boolean;
  reason: string;
}

export interface GenBlockWindow {
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
  operationalRestrictions: string | null;
}

export interface GenTrainMovement {
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

export interface GenScenarioEvent {
  id: string;
  eventType: ScenarioEventType;
  source: ScenarioEventSource;
  payload: Record<string, unknown>;
}

export interface GeneratedScenario {
  scenario: {
    id: string;
    name: string;
    seed: number;
    description: string;
    configVersion: string;
    generatedAt: string;
  };
  divisions: GenDivision[];
  stations: GenStation[];
  corridors: GenCorridor[];
  segments: GenCorridorSegment[];
  trackResources: GenTrackResource[];
  assets: GenAsset[];
  maintenanceRequests: GenMaintenanceRequest[];
  requestDependencies: GenRequestDependency[];
  taskCompatibilityRules: GenTaskCompatibilityRule[];
  blockWindows: GenBlockWindow[];
  trainMovements: GenTrainMovement[];
  scenarioEvents: GenScenarioEvent[];
}

export type { CandidateRejectionReason };
