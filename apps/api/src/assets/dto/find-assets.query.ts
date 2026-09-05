import { IsIn, IsOptional, IsUUID } from "class-validator";

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export class FindAssetsQuery {
  @IsOptional()
  @IsUUID()
  corridorId?: string;

  @IsOptional()
  @IsIn(CRITICALITY_VALUES)
  criticality?: (typeof CRITICALITY_VALUES)[number];
}
