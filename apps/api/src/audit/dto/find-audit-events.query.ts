import { IsOptional, IsString, IsUUID } from "class-validator";

export class FindAuditEventsQuery {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsString()
  entityType?: string;
}
