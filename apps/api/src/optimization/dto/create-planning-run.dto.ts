import { IsIn, IsUUID } from "class-validator";

const STRATEGY_VALUES = ["FIRST_FEASIBLE", "PRIORITY_FIRST", "OPTIMIZED"] as const;

export class CreatePlanningRunDto {
  @IsUUID()
  scenarioId!: string;

  @IsIn(STRATEGY_VALUES)
  strategy!: (typeof STRATEGY_VALUES)[number];
}
