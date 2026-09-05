import { IsOptional, IsUUID } from "class-validator";

export class FindTrainMovementsQuery {
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @IsOptional()
  @IsUUID()
  corridorId?: string;
}
