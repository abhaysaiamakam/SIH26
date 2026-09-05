import { IsOptional, IsUUID } from "class-validator";

export class FindBlockWindowsQuery {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsUUID()
  corridorId?: string;
}
