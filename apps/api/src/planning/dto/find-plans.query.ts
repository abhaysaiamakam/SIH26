import { IsIn, IsOptional, IsUUID } from "class-validator";

const STATUS_VALUES = ["DRAFT", "VALIDATED", "INVALID", "APPROVED", "REJECTED", "SUPERSEDED"] as const;

export class FindPlansQuery {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];
}
