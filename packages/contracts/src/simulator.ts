// JSON contract exchanged with services/simulator over stdin/stdout.
import { OptimizerPlanBlock, OptimizerTrainMovementInput } from "./optimizer";

export interface SimulatorRunInput {
  planRevisionId: string;
  planBlocks: OptimizerPlanBlock[];
  trainMovements: OptimizerTrainMovementInput[];
}

export interface SimulatorAffectedMovement {
  trainMovementId: string;
  trainNumber: string;
  delayMinutes: number;
  reason: string;
}

export interface SimulatorConflict {
  code: string;
  description: string;
  relatedBlockIds: string[];
  relatedTrainMovementIds: string[];
}

export interface SimulatorBlockUtilization {
  blockWindowId: string;
  utilizedMinutes: number;
  windowMinutes: number;
  utilizationRatio: number;
}

export interface SimulatorRunOutput {
  impactedTrainCount: number;
  totalDelayMinutes: number;
  affectedMovements: SimulatorAffectedMovement[];
  conflicts: SimulatorConflict[];
  blockUtilization: SimulatorBlockUtilization[];
  /** Every entry MUST be prefixed with SIMULATION_ASSUMPTION_LABEL from domain.ts */
  assumptions: string[];
}
