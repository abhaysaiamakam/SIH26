import { IsIn, IsObject, IsOptional, IsUUID } from "class-validator";

const EVENT_TYPES = [
  "CORRIDOR_UNAVAILABLE",
  "NEW_CRITICAL_REQUEST",
  "BLOCK_WINDOW_SHORTENED",
  "ADDITIONAL_TRAIN_MOVEMENT",
  "TASK_BECOMES_OVERDUE",
] as const;

const STRATEGY_VALUES = ["FIRST_FEASIBLE", "PRIORITY_FIRST", "OPTIMIZED"] as const;

export class CreateWhatIfDto {
  @IsUUID()
  scenarioId!: string;

  @IsIn(EVENT_TYPES)
  eventType!: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsIn(STRATEGY_VALUES)
  strategy?: (typeof STRATEGY_VALUES)[number];

  @IsObject()
  payload!: Record<string, unknown>;
}
