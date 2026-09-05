import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";

const DEPARTMENT_VALUES = ["ENGINEERING", "TRD", "S_AND_T"] as const;
const WORK_TYPE_VALUES = [
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
] as const;
const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const ISOLATION_VALUES = ["NONE", "TRACK_ISOLATION", "POWER_ISOLATION", "SIGNAL_ISOLATION", "FULL_ISOLATION"] as const;
const POWER_VALUES = ["NONE", "TRACTION_POWER_OFF", "AUXILIARY_POWER", "LOW_VOLTAGE"] as const;

export class RequiredResourceDto {
  @IsUUID()
  trackResourceId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateMaintenanceRequestDto {
  @IsUUID()
  scenarioId!: string;

  @IsIn(DEPARTMENT_VALUES)
  department!: (typeof DEPARTMENT_VALUES)[number];

  @IsUUID()
  assetId!: string;

  @IsUUID()
  corridorId!: string;

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsIn(WORK_TYPE_VALUES)
  workType!: (typeof WORK_TYPE_VALUES)[number];

  @IsString()
  @MinLength(3)
  description!: string;

  @IsIn(CRITICALITY_VALUES)
  criticality!: (typeof CRITICALITY_VALUES)[number];

  @IsIn(CRITICALITY_VALUES)
  urgency!: (typeof CRITICALITY_VALUES)[number];

  @IsISO8601()
  dueDate!: string;

  @IsInt()
  @IsPositive()
  estimatedDurationMinutes!: number;

  @IsOptional()
  @IsIn(ISOLATION_VALUES)
  requiredIsolation?: (typeof ISOLATION_VALUES)[number];

  @IsOptional()
  @IsIn(POWER_VALUES)
  requiredPower?: (typeof POWER_VALUES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => RequiredResourceDto)
  requiredResources?: RequiredResourceDto[];
}
