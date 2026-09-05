// Typed loader over the versioned JSON config in packages/config/v1/*.json.
// These JSON files are the single source of truth - both this TS package
// and services/optimizer (Python) read them directly, so weights never
// drift between the two languages.

import { readFileSync } from "fs";
import { join } from "path";

const V1_DIR = join(__dirname, "..", "v1");

function loadJson<T>(filename: string): T {
  const raw = readFileSync(join(V1_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export interface PriorityWeightsV1 {
  version: string;
  assetCriticalityPoints: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number>;
  maintenanceCriticalityPoints: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number>;
  urgencyPoints: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number>;
  overdue: { baseBonus: number; perDayBonus: number; maxBonus: number };
  dueSoon: { thresholds: { withinDays: number; bonus: number }[] };
}

export interface ObjectiveWeightsV1 {
  version: string;
  priorityWeight: number;
  bundleBonusPerExtraTask: number;
  assetAvailabilityPoints: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number>;
  blockUtilizationWeight: number;
  delayMinutePenalty: number;
  fragmentationPenaltyPerBlock: number;
  blockUsedPenalty: number;
}

export interface CompatibilityPairRule {
  workTypeA: string;
  workTypeB: string;
  reason: string;
}

export interface CompatibilityDefaultsV1 {
  version: string;
  sameDepartmentDefaultCompatible: boolean;
  crossDepartmentDefaultCompatible: boolean;
  crossDepartmentAllowList: CompatibilityPairRule[];
  sameDepartmentIncompatiblePairs: CompatibilityPairRule[];
  hardIncompatiblePairs: CompatibilityPairRule[];
}

export interface SolverSettingsV1 {
  version: string;
  numSearchWorkers: number;
  randomSeed: number;
  timeLimitSeconds: number;
  planningHorizonDays: number;
  dueSoonWindowDays: number;
}

export function loadPriorityWeightsV1(): PriorityWeightsV1 {
  return loadJson<PriorityWeightsV1>("priority-weights.json");
}

export function loadObjectiveWeightsV1(): ObjectiveWeightsV1 {
  return loadJson<ObjectiveWeightsV1>("objective-weights.json");
}

export function loadCompatibilityDefaultsV1(): CompatibilityDefaultsV1 {
  return loadJson<CompatibilityDefaultsV1>("compatibility-defaults.json");
}

export function loadSolverSettingsV1(): SolverSettingsV1 {
  return loadJson<SolverSettingsV1>("solver-settings.json");
}

export const CONFIG_VERSION = "v1";
