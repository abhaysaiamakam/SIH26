import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";

const DEPARTMENT_VALUES = ["ENGINEERING", "TRD", "S_AND_T"] as const;
const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUS_VALUES = [
  "OPEN",
  "VERIFIED",
  "PRIORITIZED",
  "BLOCK_REQUESTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
] as const;

export class FindMaintenanceQuery {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsIn(DEPARTMENT_VALUES)
  department?: (typeof DEPARTMENT_VALUES)[number];

  @IsOptional()
  @IsUUID()
  corridorId?: string;

  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  criticality?: (typeof CRITICALITY_VALUES)[number];

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  overdue?: boolean;
}
