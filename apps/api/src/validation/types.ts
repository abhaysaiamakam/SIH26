export type ViolationSeverity = "WARNING" | "ERROR" | "CRITICAL";

export type ViolationCode =
  | "TASK_DOUBLE_BOOKED"
  | "BLOCK_OUTSIDE_WINDOW"
  | "DURATION_INSUFFICIENT"
  | "RESOURCE_OVERLAP"
  | "ISOLATION_VIOLATION"
  | "POWER_VIOLATION"
  | "INCOMPATIBLE_BUNDLE"
  | "DEPENDENCY_VIOLATION"
  | "OPERATIONAL_CONFLICT"
  | "DEPARTMENT_NOT_PERMITTED";

export interface Violation {
  code: ViolationCode;
  severity: ViolationSeverity;
  message: string;
  relatedTaskIds: string[];
}
